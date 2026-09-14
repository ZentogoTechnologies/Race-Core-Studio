"""Trazados de pista: alta, imagen y cuál está activo.

La imagen vive en public/trazados, con el resto de lo que sube el cliente
—fotos de pilotos, logos de categorías—, y se llama como el trazado: 3.png
es la del trazado 3. Así se sabe qué es cada archivo sin abrirlo, y
renombrar el circuito no deja la imagen con un nombre que ya no le toca.

CasparCG la pide por HTTP al backend, igual que las fotos de los pilotos.
La plantilla se abre con file:// y no tiene contra qué resolver una ruta
relativa fuera de su carpeta, así que la dirección va completa.
"""

import shutil
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from src.models.tracks_model import Trazado

import rutas

# public/trazados. Instalado es ProgramData; en desarrollo, Backend/src/public.
CARPETA_IMAGENES = rutas.PUBLICO / "trazados"

# Donde vivieron antes, y solo se miran al arrancar para traer lo que
# quede: public/circuit-image en las primeras instalaciones, y dentro de
# la plantilla de CasparCG en las versiones anteriores a esas.
CARPETAS_ANTIGUAS = (
    rutas.PUBLICO / "circuit-image",
    rutas.PLANTILLAS / "img" / "circuits",
)

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

# Un trazado no llega ni de lejos a esto; el tope está para que un fichero
# equivocado no llene el disco.
TOPE_BYTES = 12 * 1024 * 1024


def nombre_de(trazado_id: int, extension: str) -> str:
    """El nombre del archivo de un trazado: su número y nada más."""
    return f"{trazado_id}{extension.lower()}"


def ruta_plantilla(imagen: Optional[str]) -> Optional[str]:
    """La URL con la que CasparCG carga la imagen del trazado.

    Absoluta y por HTTP, no una ruta de disco: la plantilla se abre desde
    file://. Significa que el backend tiene que estar corriendo para que el
    trazado salga al aire, que no es nada nuevo: sin backend tampoco salen
    las fotos, los logos ni el cronometraje.
    """
    from config import settings

    if not imagen:
        return None

    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/public/trazados/{imagen}"


async def migrar_imagenes_antiguas() -> list[str]:
    """Trae a public/trazados las imágenes guardadas con el esquema anterior.

    Antes vivían dentro de la plantilla y se llamaban con el nombre del
    circuito —3-autodromo-panama.png—. Se hace al arrancar y no con un
    script aparte para que ninguna instalación se quede con trazados sin
    imagen por no haberlo corrido.

    Idempotente: lo ya migrado no se toca. Se copia primero y el original
    solo se borra cuando la base ya apunta al nuevo, así que un corte a
    mitad no deja a ningún trazado sin su imagen.
    """
    hechos = []
    copiados = set()

    for doc in await Trazado.find({"image": {"$nin": [None, ""]}}).to_list():
        nuevo = nombre_de(doc.trazado_id, Path(doc.image).suffix)
        destino = CARPETA_IMAGENES / nuevo

        if doc.image == nuevo and destino.is_file():
            continue

        origen = next((carpeta / doc.image
                       for carpeta in (CARPETA_IMAGENES, *CARPETAS_ANTIGUAS)
                       if (carpeta / doc.image).is_file()), None)

        # La base la nombra pero no está en ningún sitio. No hay nada que
        # traer, y vaciar el campo borraría la pista de qué faltaba.
        if origen is None:
            continue

        CARPETA_IMAGENES.mkdir(parents=True, exist_ok=True)

        if origen.resolve() != destino.resolve():
            shutil.copy2(origen, destino)
            copiados.add(origen)

        doc.image = nuevo
        await doc.save()
        hechos.append(f"{origen.name} -> trazados/{nuevo}")

    # Los originales se van cuando ningún trazado los nombra ya.
    for origen in copiados:
        if await Trazado.find_one({"image": origen.name}) is None:
            try:
                origen.unlink()
            except OSError:
                pass

    return hechos


class TrazadosService:

    async def _siguiente_id(self) -> int:
        ultimo = await Trazado.find_all().sort(-Trazado.trazado_id).first_or_none()
        return (ultimo.trazado_id + 1) if ultimo else 1

    async def listar(self, discipline: Optional[str] = None) -> list[Trazado]:
        filtro = {"discipline": discipline} if discipline else {}
        return await Trazado.find(filtro).sort(Trazado.trazado_id).to_list()

    async def obtener(self, trazado_id: int) -> Trazado:
        doc = await Trazado.find_one({"trazado_id": trazado_id})
        if doc is None:
            raise HTTPException(404, f"No existe el trazado {trazado_id}")
        return doc

    async def activo(self) -> Optional[Trazado]:
        return await Trazado.find_one({"activo": True})

    async def crear(self, datos: dict) -> Trazado:
        # Se mira antes de insertar: después siempre habría al menos uno.
        primero = await Trazado.find_one({}) is None

        doc = Trazado(trazado_id=await self._siguiente_id(), **datos)

        # El primero que se da de alta queda activo. Si no, habría un
        # trazado guardado y el gráfico seguiría sin imagen hasta que
        # alguien cayera en pulsar "usar este".
        if primero:
            doc.activo = True

        await doc.insert()
        return doc

    async def actualizar(self, trazado_id: int, datos: dict) -> Trazado:
        doc = await self.obtener(trazado_id)

        for campo, valor in datos.items():
            if valor is not None:
                setattr(doc, campo, valor)

        await doc.save()
        return doc

    async def activar(self, trazado_id: int) -> Trazado:
        doc = await self.obtener(trazado_id)

        # Solo uno a la vez. Se apagan todos y se enciende este, en vez de
        # apagar "el que estuviera": si dos quedaron activos por lo que sea,
        # esto lo deja bien igualmente.
        await Trazado.find({"activo": True}).update({"$set": {"activo": False}})

        doc.activo = True
        await doc.save()
        return doc

    async def borrar(self, trazado_id: int) -> dict:
        doc = await self.obtener(trazado_id)

        imagen = doc.image
        era_activo = doc.activo

        await doc.delete()

        # La imagen se va con el trazado, pero solo si no la comparte otro.
        if imagen:
            en_uso = await Trazado.find_one({"image": imagen})
            if en_uso is None:
                fichero = CARPETA_IMAGENES / imagen
                if fichero.is_file():
                    try:
                        fichero.unlink()
                    except OSError:
                        # Que no se pueda borrar el fichero no invalida el
                        # borrado del trazado, que ya está hecho.
                        pass

        # Sin activo el gráfico se quedaría con la imagen de fábrica; se
        # pasa el testigo al primero que quede.
        if era_activo:
            siguiente = await Trazado.find_all().sort(Trazado.trazado_id).first_or_none()
            if siguiente is not None:
                siguiente.activo = True
                await siguiente.save()

        return {"ok": True, "trazado_id": trazado_id}

    # ── Imagen ────────────────────────────────────────────────────────

    def _destino(self, doc: Trazado, extension: str) -> Path:
        CARPETA_IMAGENES.mkdir(parents=True, exist_ok=True)
        return CARPETA_IMAGENES / nombre_de(doc.trazado_id, extension)

    async def _asignar(self, doc: Trazado, destino: Path) -> Trazado:
        anterior = doc.image

        doc.image = destino.name
        await doc.save()

        # La de antes se borra si nadie más la usa y no es la que se acaba
        # de escribir. Con el nombre por número solo difieren cuando cambia
        # la extensión: 3.jpg se va al subir 3.png.
        if anterior and anterior != destino.name:
            en_uso = await Trazado.find_one({"image": anterior})
            if en_uso is None:
                viejo = CARPETA_IMAGENES / anterior
                if viejo.is_file():
                    try:
                        viejo.unlink()
                    except OSError:
                        pass

        return doc

    def _revisar_extension(self, nombre: str) -> str:
        extension = Path(nombre or "").suffix.lower()

        if extension not in EXTENSIONES:
            raise HTTPException(
                400,
                f"'{extension or nombre}' no es una imagen. Se aceptan: "
                + ", ".join(sorted(EXTENSIONES)),
            )

        return extension

    async def subir_imagen(self, trazado_id: int, nombre: str, contenido: bytes) -> Trazado:
        """La que llega desde el navegador."""
        doc = await self.obtener(trazado_id)

        extension = self._revisar_extension(nombre)

        if not contenido:
            raise HTTPException(400, "El fichero llegó vacío")

        if len(contenido) > TOPE_BYTES:
            raise HTTPException(
                400,
                f"La imagen pesa {len(contenido) / 1048576:.1f} MB y el tope son "
                f"{TOPE_BYTES // 1048576} MB",
            )

        destino = self._destino(doc, extension)
        destino.write_bytes(contenido)

        return await self._asignar(doc, destino)

    async def copiar_imagen(self, trazado_id: int, ruta: str) -> Trazado:
        """La que ya está en el disco del servidor, escrita a mano."""
        doc = await self.obtener(trazado_id)

        origen = Path((ruta or "").strip().strip('"'))

        if not origen.is_absolute():
            raise HTTPException(
                400, "Escribe la ruta completa, del tipo C:\\imagenes\\pista.jpg")

        if not origen.exists():
            raise HTTPException(404, f"No existe: {origen}")

        if not origen.is_file():
            raise HTTPException(400, f"{origen} no es un fichero")

        extension = self._revisar_extension(origen.name)

        if origen.stat().st_size > TOPE_BYTES:
            raise HTTPException(
                400, f"La imagen supera los {TOPE_BYTES // 1048576} MB")

        destino = self._destino(doc, extension)

        try:
            shutil.copyfile(origen, destino)
        except OSError as e:
            raise HTTPException(400, f"No se pudo leer la imagen: {e}")

        return await self._asignar(doc, destino)


trazados_service = TrazadosService()
