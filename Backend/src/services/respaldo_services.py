"""Respaldo completo del sistema en un solo archivo .rcs-backup.

Lleva todo lo que el cliente ha ido cargando y que no se puede volver a
bajar de ningún sitio: la base de datos entera —pilotos, vehículos,
eventos, usuarios, ajustes— y las imágenes —fotos de pilotos y
vehículos, logos de categorías, marcas y del cliente, imágenes de eventos
y trazados—.

El archivo va sellado. Por dentro es un ZIP, pero no se abre como uno:
lleva una cabecera propia, el contenido cifrado con una clave del
producto y una firma al final. Así no se puede abrir con otro programa
ni editar a mano, y si se corrompe o alguien lo toca, el software lo
detecta y se niega a usarlo antes de pisar nada.

    ⚠ Es un sello, no una caja fuerte. La clave viaja dentro del software,
    así que alguien decidido que desmonte el programa podría abrirlo. Lo
    que sí garantiza es que el respaldo solo sirve para restaurar en Race
    Core Studio y que un archivo alterado o dañado no se restaura.

Restaurar reemplaza todo por lo que trae el respaldo. Antes de tocar
nada se guarda una copia del estado actual en la carpeta de respaldos,
así que una restauración equivocada también tiene vuelta atrás.
"""

import hashlib
import hmac
import io
import json
import secrets
import zipfile
from datetime import datetime
from pathlib import Path

from bson.json_util import CANONICAL_JSON_OPTIONS, dumps, loads
from pymongo import MongoClient

from config import settings

EXTENSION = ".rcs-backup"
PRODUCTO = "race-core-studio"

# Lo primero del archivo. Si no empieza así, no es un respaldo nuestro.
MAGIA = b"RCSBACKUP"
VERSION_FORMATO = 1

# De aquí sale la clave de cada respaldo, junto con una sal aleatoria.
# Cambiarlo dejaría inservibles todos los respaldos ya hechos.
_SELLO = b"race-core-studio/respaldo/v1/7f3c9a2e-5b18-4d6f-a0c4-91e2b7d85a13"
_ITERACIONES = 120_000

_TAM_SAL = 16
_TAM_FIRMA = 32


# ── Dónde está cada cosa ──────────────────────────────────────────

def _carpetas() -> dict:
    """Las carpetas de imágenes, tomadas de los propios servicios.

    Se preguntan a cada servicio en vez de escribirlas aquí: así, esté
    instalado o en desarrollo, el respaldo mira exactamente donde el
    programa guarda.
    """
    from src.services.categories_services import CARPETA_LOGOS as categorias
    from src.services.events_services import CARPETA_IMAGENES as eventos
    from src.services.marcas_services import CARPETA_LOGOS as marcas
    from src.services.pilots_services import CARPETA_FOTOS as pilotos
    from src.services.tracks_services import CARPETA_IMAGENES as trazados
    from src.services.vehicles_services import CARPETA_FOTOS as vehiculos

    return {
        "pilotos": pilotos,
        "vehiculos": vehiculos,
        "categorias": categorias,
        "eventos": eventos,
        "trazados": trazados,
        "marcas": marcas,
    }


def _logo_cliente() -> Path:
    from src.services.settings_services import LOGO_CLIENTE
    return LOGO_CLIENTE


def carpeta_respaldos() -> Path:
    """Donde se dejan las copias automáticas previas a restaurar.

    Instalado, junto a los demás datos del cliente; en desarrollo, en
    Backend/respaldos, que no va a git.
    """
    try:
        import rutas
        return rutas.DATOS / "respaldos"
    except ImportError:
        return Path(__file__).resolve().parents[2] / "respaldos"


# ── El sello ──────────────────────────────────────────────────────

def _claves(sal: bytes) -> tuple:
    material = hashlib.pbkdf2_hmac("sha256", _SELLO, sal, _ITERACIONES, dklen=64)
    return material[:32], material[32:]


def _mezclar(datos: bytes, clave: bytes, sal: bytes) -> bytes:
    """Cifra o descifra: es la misma operación en los dos sentidos."""
    if not datos:
        return b""
    flujo = hashlib.shake_256(clave + sal).digest(len(datos))
    mezcla = int.from_bytes(datos, "little") ^ int.from_bytes(flujo, "little")
    return mezcla.to_bytes(len(datos), "little")


def sellar(contenido: bytes) -> bytes:
    sal = secrets.token_bytes(_TAM_SAL)
    clave_cifrado, clave_firma = _claves(sal)

    cabecera = MAGIA + bytes([VERSION_FORMATO]) + sal
    cuerpo = _mezclar(contenido, clave_cifrado, sal)
    firma = hmac.new(clave_firma, cabecera + cuerpo, hashlib.sha256).digest()

    return cabecera + cuerpo + firma


def abrir(archivo: bytes) -> bytes:
    """Comprueba el sello y devuelve el contenido. Falla con motivo claro."""
    minimo = len(MAGIA) + 1 + _TAM_SAL + _TAM_FIRMA
    if len(archivo) < minimo or not archivo.startswith(MAGIA):
        raise ValueError("Este archivo no es un respaldo de Race Core Studio.")

    version = archivo[len(MAGIA)]
    if version != VERSION_FORMATO:
        raise ValueError(
            f"Este respaldo usa un formato ({version}) que esta versión del "
            "programa no sabe leer.")

    inicio_cuerpo = len(MAGIA) + 1 + _TAM_SAL
    sal = archivo[len(MAGIA) + 1:inicio_cuerpo]
    cuerpo = archivo[inicio_cuerpo:-_TAM_FIRMA]
    firma = archivo[-_TAM_FIRMA:]

    clave_cifrado, clave_firma = _claves(sal)
    esperada = hmac.new(clave_firma, archivo[:-_TAM_FIRMA], hashlib.sha256).digest()
    if not hmac.compare_digest(firma, esperada):
        raise ValueError(
            "El respaldo está dañado o fue modificado, así que no se puede usar.")

    return _mezclar(cuerpo, clave_cifrado, sal)


# ── Crear ─────────────────────────────────────────────────────────

def _base():
    cliente = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
    return cliente, cliente[settings.DB_NAME]


def crear() -> tuple:
    """Arma el respaldo. Devuelve (archivo sellado, nombre sugerido, manifiesto)."""
    ahora = datetime.now()
    manifiesto = {
        "producto": PRODUCTO,
        "formato": VERSION_FORMATO,
        "creado": ahora.isoformat(timespec="seconds"),
        "version": getattr(settings, "APP_VERSION", None),
        "colecciones": {},
        "archivos": {},
    }

    zip_en_memoria = io.BytesIO()
    cliente, base = _base()
    try:
        with zipfile.ZipFile(zip_en_memoria, "w", zipfile.ZIP_DEFLATED) as z:
            for nombre in sorted(base.list_collection_names()):
                if nombre.startswith("system."):
                    continue
                documentos = list(base[nombre].find({}))
                z.writestr(f"colecciones/{nombre}.json",
                           dumps(documentos, json_options=CANONICAL_JSON_OPTIONS))
                manifiesto["colecciones"][nombre] = len(documentos)

            for clave, carpeta in _carpetas().items():
                cuantos = 0
                if carpeta.is_dir():
                    for archivo in sorted(carpeta.iterdir()):
                        if archivo.is_file():
                            z.write(archivo, f"archivos/{clave}/{archivo.name}")
                            cuantos += 1
                manifiesto["archivos"][clave] = cuantos

            logo = _logo_cliente()
            if logo.is_file():
                z.write(logo, "archivos/logo-cliente.png")
                manifiesto["archivos"]["logo-cliente"] = 1

            z.writestr("manifiesto.json", json.dumps(manifiesto, ensure_ascii=False, indent=1))
    finally:
        cliente.close()

    nombre_archivo = f"race-core-studio-{ahora:%Y-%m-%d-%H%M}{EXTENSION}"
    return sellar(zip_en_memoria.getvalue()), nombre_archivo, manifiesto


# ── Revisar y restaurar ───────────────────────────────────────────

def _abrir_zip(archivo: bytes) -> tuple:
    contenido = abrir(archivo)
    try:
        z = zipfile.ZipFile(io.BytesIO(contenido))
        manifiesto = json.loads(z.read("manifiesto.json"))
    except (zipfile.BadZipFile, KeyError, ValueError):
        raise ValueError("El respaldo está incompleto y no se puede usar.")

    if manifiesto.get("producto") != PRODUCTO:
        raise ValueError("Este respaldo es de otro producto.")

    return z, manifiesto


def revisar(archivo: bytes) -> dict:
    """Lo que trae un respaldo, sin tocar nada. Para confirmar antes."""
    _, manifiesto = _abrir_zip(archivo)
    return manifiesto


def restaurar(archivo: bytes) -> dict:
    """Reemplaza base e imágenes por las del respaldo.

    Primero se valida el respaldo entero y se guarda una copia del estado
    actual. Solo después se toca algo.
    """
    z, manifiesto = _abrir_zip(archivo)

    # Las colecciones se leen todas antes de borrar ninguna: si alguna viene
    # mal, que falle ahora y no con la base a medio vaciar.
    colecciones = {}
    for nombre in manifiesto.get("colecciones", {}):
        try:
            colecciones[nombre] = loads(z.read(f"colecciones/{nombre}.json").decode("utf-8"),
                                        json_options=CANONICAL_JSON_OPTIONS)
        except (KeyError, ValueError):
            raise ValueError(f"El respaldo está incompleto: falta la colección {nombre}.")

    actual, nombre_actual, _ = crear()
    destino_copia = carpeta_respaldos()
    destino_copia.mkdir(parents=True, exist_ok=True)
    copia_previa = destino_copia / f"antes-de-restaurar-{nombre_actual}"
    copia_previa.write_bytes(actual)

    try:
        cliente, base = _base()
        try:
            for nombre, documentos in colecciones.items():
                base[nombre].delete_many({})
                if documentos:
                    base[nombre].insert_many(documentos, ordered=False)
        finally:
            cliente.close()

        for clave, carpeta in _carpetas().items():
            if clave not in manifiesto.get("archivos", {}):
                continue

            carpeta.mkdir(parents=True, exist_ok=True)

            # Cada carpeta queda como en el respaldo. Los archivos que empiezan
            # por _ son del programa —la silueta de reserva, el logo genérico—
            # y no se borran aunque el respaldo no los traiga.
            for existente in carpeta.iterdir():
                if existente.is_file() and not existente.name.startswith("_"):
                    existente.unlink()

            prefijo = f"archivos/{clave}/"
            for entrada in z.infolist():
                if entrada.is_dir() or not entrada.filename.startswith(prefijo):
                    continue
                # Solo el nombre: una ruta escrita a mano dentro del ZIP no
                # puede sacar un archivo de su carpeta.
                (carpeta / Path(entrada.filename).name).write_bytes(z.read(entrada))

        if "archivos/logo-cliente.png" in z.namelist():
            _logo_cliente().write_bytes(z.read("archivos/logo-cliente.png"))
    except Exception as e:
        raise RuntimeError(
            f"La restauración falló a mitad ({e}). El estado anterior está guardado "
            f"en {copia_previa} y se puede restaurar desde ahí.")

    return {"restaurado": manifiesto, "copia_previa": str(copia_previa)}
