"""Quita el fondo de una foto y deja al piloto recortado.

Se hace en el servidor y no en el navegador ni en una nube. En el
autódromo la red se cae o está aislada, y una foto que no se puede
recortar porque no hay internet es una foto que se queda con el fondo del
taller. El modelo va en disco y funciona sin conexión.

El modelo se carga una sola vez y se guarda: la primera llamada tarda unos
segundos y las siguientes son inmediatas.
"""

import io
from typing import Optional

from PIL import Image, ImageOps

# u2net_human_seg y no el general: está entrenado solo con personas, que es
# lo único que se recorta aquí, y acierta más en gorras y pelo, que es
# justo donde se nota un recorte malo.
MODELO = "u2net_human_seg"

# Las fotos llegan de un iPad a 4000px de ancho y el arte no las necesita:
# el retrato más grande que se pinta es el de la grilla, que ocupa media
# pantalla. Reducir antes de recortar baja el trabajo del modelo de
# segundos a décimas y el PNG resultante de cinco megas a menos de uno.
LADO_MAXIMO = 1400

_sesion = None


def _obtener_sesion():
    """La sesión del modelo, cargada una sola vez por proceso."""
    global _sesion
    if _sesion is None:
        from rembg import new_session
        _sesion = new_session(MODELO)
    return _sesion


def quitar_fondo(contenido: bytes) -> bytes:
    """Devuelve la foto en PNG con el fondo transparente.

    Se normaliza la orientación antes de recortar. Las fotos de móvil
    traen la rotación en los datos EXIF en vez de en los píxeles, y el PNG
    de salida no lleva EXIF: sin enderezarla primero, un retrato tomado en
    vertical se guardaría tumbado para siempre.
    """
    from rembg import remove

    imagen = Image.open(io.BytesIO(contenido))
    imagen = ImageOps.exif_transpose(imagen)

    if max(imagen.size) > LADO_MAXIMO:
        imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)

    recortada = remove(imagen.convert("RGB"), session=_obtener_sesion())

    salida = io.BytesIO()
    recortada.save(salida, format="PNG", optimize=True)
    return salida.getvalue()
