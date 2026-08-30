"""Guardar imágenes que llegan desde la interfaz.

Lo usan los trazados de pista y las fotos de pilotos. Son dos sitios
distintos del disco pero el trabajo es el mismo: comprobar que lo que
llega es una imagen, que no es desmesurada, escribirla con un nombre
predecible y borrar la que sustituye.

Está aparte a propósito. La primera versión llevaba estas comprobaciones
copiadas en cada servicio, y ya sabemos cómo acaba eso: se corrige una y
la otra se queda con el fallo.
"""

import re
import shutil
import time
import unicodedata
from pathlib import Path

from fastapi import HTTPException

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

# Ni un trazado ni un retrato llegan a esto; el tope está para que un
# fichero equivocado no llene el disco.
TOPE_BYTES = 12 * 1024 * 1024


def sanear(texto: str) -> str:
    """Un nombre de fichero seguro a partir de un texto cualquiera."""
    limpio = unicodedata.normalize("NFD", texto or "")
    limpio = "".join(c for c in limpio if unicodedata.category(c) != "Mn")
    limpio = re.sub(r"[^a-zA-Z0-9]+", "-", limpio).strip("-").lower()
    return limpio


def revisar_extension(nombre: str) -> str:
    """La extensión en minúsculas, o un 400 explicando qué se acepta."""
    extension = Path(nombre or "").suffix.lower()

    if extension not in EXTENSIONES:
        raise HTTPException(
            400,
            f"'{extension or nombre}' no es una imagen. Se aceptan: "
            + ", ".join(sorted(EXTENSIONES)),
        )

    return extension


def revisar_tamano(bytes_: int) -> None:
    if bytes_ > TOPE_BYTES:
        raise HTTPException(
            400,
            f"La imagen pesa {bytes_ / 1048576:.1f} MB y el tope son "
            f"{TOPE_BYTES // 1048576} MB",
        )


def borrar_si_sobra(anterior: Path | None, destino: Path) -> None:
    """Quita la imagen sustituida.

    No se borra cuando coincide con la nueva: al repetir extensión, el
    destino y la anterior son el mismo fichero y se borraría lo recién
    escrito.
    """
    if anterior is None or anterior == destino:
        return

    if not anterior.is_file():
        return

    # En Windows el fichero queda tomado un instante después de servirlo,
    # y el primer intento falla con "lo está usando otro proceso". Se
    # reintenta un par de veces antes de rendirse: sin esto la foto vieja
    # se quedaba en disco cada vez que se había visto en pantalla.
    for intento in range(3):
        try:
            anterior.unlink()
            return
        except FileNotFoundError:
            return
        except OSError:
            if intento < 2:
                time.sleep(0.15)

    # El registro ya apunta a la nueva; no poder borrar la vieja deja
    # basura en disco, no un dato incorrecto.


def guardar_bytes(contenido: bytes, nombre_original: str, destino_sin_ext: Path) -> Path:
    """Escribe lo que subió el navegador. Devuelve el fichero creado."""
    extension = revisar_extension(nombre_original)

    if not contenido:
        raise HTTPException(400, "El fichero llegó vacío")

    revisar_tamano(len(contenido))

    destino_sin_ext.parent.mkdir(parents=True, exist_ok=True)

    destino = destino_sin_ext.with_suffix(extension)
    destino.write_bytes(contenido)

    return destino


def copiar_de_ruta(ruta: str, destino_sin_ext: Path) -> Path:
    """Trae una imagen que ya está en el disco del servidor."""
    origen = Path((ruta or "").strip().strip('"'))

    if not origen.is_absolute():
        raise HTTPException(
            400, "Escribe la ruta completa, del tipo C:\\imagenes\\foto.jpg")

    if not origen.exists():
        raise HTTPException(404, f"No existe: {origen}")

    if not origen.is_file():
        raise HTTPException(400, f"{origen} no es un fichero")

    extension = revisar_extension(origen.name)
    revisar_tamano(origen.stat().st_size)

    destino_sin_ext.parent.mkdir(parents=True, exist_ok=True)

    destino = destino_sin_ext.with_suffix(extension)

    try:
        shutil.copyfile(origen, destino)
    except OSError as e:
        raise HTTPException(400, f"No se pudo leer la imagen: {e}")

    return destino
