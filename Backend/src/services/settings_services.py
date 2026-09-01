"""Ajustes que se cambian sin reiniciar.

La ruta del current.xml se guarda en la base, pero `leer_xml` es síncrona
y se llama muchas veces por segundo desde las plantillas. Consultar Mongo
en cada lectura sería absurdo, así que el valor se mantiene en memoria y
se refresca al arrancar y cada vez que alguien lo cambia.
"""

import io
import shutil
from pathlib import Path
from typing import Optional

from config import settings
from src.models.settings_model import Ajustes

# Valor vivo del proceso. None significa "usa el del .env".
_ruta_timing: Optional[str] = None

# Dónde se buscan XML para ofrecerlos en la lista. La carpeta public es la
# que ya se usa para material del proyecto.
CARPETAS_CANDIDATAS = [
    Path(__file__).resolve().parents[1] / "public",
]

# ── Logo del cliente ──────────────────────────────────────────────
#
# Todas las plantillas apuntan a este archivo, así que cambiarlo cambia el
# logo en los veintidós gráficos de una vez. Se escribe siempre en el mismo
# sitio y en PNG, sea cual sea el formato que suban: así la ruta de las
# plantillas es fija y no hay que tocarlas nunca más.

RAIZ = Path(__file__).resolve().parents[3]

LOGO_CLIENTE = RAIZ / "Casparcg" / "template" / "img" / "logo-cliente.png"

# El de fábrica, que no se toca: es a donde se vuelve al quitar el suyo.
LOGO_FABRICA = RAIZ / "Casparcg" / "template" / "img" / "logoap.png"


def url_logo_cliente() -> str:
    """Con qué versión pedirlo, para que el navegador no lo cachee."""
    if not LOGO_CLIENTE.is_file():
        return ""
    return f"/media/logo/logo-cliente.png?v={int(LOGO_CLIENTE.stat().st_mtime)}"


def guardar_logo_cliente(contenido: bytes, nombre: str) -> None:
    """Escribe el logo subido en el sitio que miran las plantillas.

    Se convierte a PNG con transparencia porque los gráficos lo ponen
    sobre paneles oscuros: un JPG llegaría con su fondo blanco recortado
    en un rectángulo y se vería como un parche.
    """
    from fastapi import HTTPException
    from PIL import Image, UnidentifiedImageError

    if not contenido:
        raise HTTPException(400, "El archivo llegó vacío")

    try:
        imagen = Image.open(io.BytesIO(contenido))
        imagen.load()
    except (UnidentifiedImageError, OSError) as e:
        raise HTTPException(400, f"'{nombre}' no se pudo leer como imagen ({e})")

    LOGO_CLIENTE.parent.mkdir(parents=True, exist_ok=True)
    imagen.convert("RGBA").save(LOGO_CLIENTE, format="PNG")


def restaurar_logo_fabrica() -> None:
    """Vuelve al logo que trae el software."""
    from fastapi import HTTPException

    if not LOGO_FABRICA.is_file():
        raise HTTPException(500, "No encuentro el logo de fábrica para restaurarlo")

    shutil.copyfile(LOGO_FABRICA, LOGO_CLIENTE)


def ruta_timing() -> str:
    """La ruta que debe leerse ahora mismo."""
    return _ruta_timing or settings.TIMING_XML_PATH


async def cargar_ajustes():
    """Trae lo guardado a memoria. Se llama al arrancar el backend."""
    global _ruta_timing

    doc = await Ajustes.find_one({})
    _ruta_timing = doc.timing_xml_path if doc else None
    return _ruta_timing


async def marcar_logo_cliente(nombre: Optional[str]) -> None:
    """Deja constancia de si hay un logo propio puesto."""
    doc = await Ajustes.find_one({})
    if doc is None:
        doc = Ajustes(client_logo=nombre)
        await doc.insert()
    else:
        doc.client_logo = nombre
        await doc.save()


async def logo_cliente_actual() -> Optional[str]:
    doc = await Ajustes.find_one({})
    return doc.client_logo if doc else None


async def guardar_ruta_timing(ruta: Optional[str]) -> Optional[str]:
    """Cambia la ruta y la deja aplicada de inmediato."""
    global _ruta_timing

    limpia = (ruta or "").strip() or None

    doc = await Ajustes.find_one({})
    if doc is None:
        doc = Ajustes(timing_xml_path=limpia)
        await doc.insert()
    else:
        doc.timing_xml_path = limpia
        await doc.save()

    _ruta_timing = limpia
    return _ruta_timing


def revisar_ruta(ruta: str) -> dict:
    """Comprueba si esa ruta sirve, sin aplicarla.

    Se responde con detalle en vez de un sí o un no: el caso normal de
    fallo es una unidad de red caída, y saber si el problema es la unidad,
    la carpeta o el archivo ahorra media hora en pista.
    """
    if not ruta or not ruta.strip():
        return {"ok": False, "detalle": "La ruta está vacía"}

    archivo = Path(ruta.strip())

    if not archivo.exists():
        padre = archivo.parent
        if not padre.exists():
            return {
                "ok": False,
                "detalle": f"No existe la carpeta {padre}. ¿Está conectada la unidad de red?",
            }
        return {"ok": False, "detalle": f"La carpeta existe pero no está el archivo {archivo.name}"}

    if not archivo.is_file():
        return {"ok": False, "detalle": "Esa ruta es una carpeta, no un archivo"}

    # Se intenta leer de verdad: un archivo que existe pero está bloqueado
    # por MyLaps mientras escribe también falla, y conviene verlo aquí.
    try:
        from src.services.timing_services import leer_xml

        datos = leer_xml(str(archivo))
    except Exception as e:
        return {"ok": False, "detalle": f"No se pudo leer: {type(e).__name__}: {str(e)[:100]}"}

    etiquetas = datos.get("labels", {})
    return {
        "ok": True,
        "detalle": "Archivo leído correctamente",
        "evento": etiquetas.get("eventname"),
        "tanda": etiquetas.get("runname"),
        "grupo": etiquetas.get("groupname"),
        "filas": len(datos.get("filas", [])),
    }


def xml_detectados() -> list[dict]:
    """XML que el servidor alcanza, para ofrecerlos en una lista.

    Incluye siempre la ruta configurada aunque no exista: si la unidad de
    red está caída hay que poder verla en la lista y saber que sigue
    siendo la elegida.
    """
    vistos = []
    rutas = set()

    for carpeta in CARPETAS_CANDIDATAS:
        if not carpeta.exists():
            continue
        for archivo in sorted(carpeta.glob("*.xml")):
            rutas.add(str(archivo))
            vistos.append({
                "ruta": str(archivo),
                "nombre": archivo.name,
                "existe": True,
                "origen": "proyecto",
            })

    actual = ruta_timing()
    if actual not in rutas:
        vistos.insert(0, {
            "ruta": actual,
            "nombre": Path(actual).name,
            "existe": Path(actual).exists(),
            "origen": "configurada",
        })

    return vistos
