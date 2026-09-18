"""
EL CATÁLOGO DE MARCAS

La marca de un vehículo se elegía escribiéndola, y en la base convivían
"Bmw" y "BMW", "Audi" y "AUDI", "Changan" y "CHANGAN" como si fueran
marcas distintas. Peor: el logo se busca por el nombre, así que "Mc Laren"
no encontraba `mclaren.png` y salía al aire sin logo sin que nadie se
enterara.

Ahora se elige de una lista cerrada. El identificador de cada marca es su
nombre en minúsculas y con guiones —el mismo `slug` con el que se nombran
los archivos de logo—, así que elegir la marca es garantizar que su logo
se encuentra.

La lista vive en `data/marcas.json` y la sirve el backend. No se duplica
en el panel a propósito: dos listas se separan en cuanto se toca una, y la
que manda tiene que ser la que valida.

Los logos son otra cosa. Son marcas registradas y no hay un paquete con
licencia que se pueda empaquetar como se hizo con las banderas, así que
vienen los que haya en `public/marcas` y la marca que no tenga el suyo
sale con la bandera de su país hasta que alguien lo suba, que se hace
desde el mismo formulario del vehículo: es ahí donde se descubre que
falta.
"""

import io
import json
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Optional

import rutas

# La lista es producto: congelado viaja dentro del ejecutable (backend.spec
# la mete en data/), y en desarrollo sigue en src/data.
DATOS = ((rutas.RECURSOS / "data" / "marcas.json") if rutas.CONGELADO
         else Path(__file__).resolve().parents[1] / "data" / "marcas.json")

# Los logos, en cambio, son del cliente: se siembran en ProgramData y ahí
# se guardan los que suba. Es la misma carpeta que mira brand_logo_url().
CARPETA_LOGOS = rutas.PUBLICO / "marcas"

TIPOS = ("auto", "moto", "kart")


def slug(valor: str) -> str:
    """'Mini Cooper' -> 'mini-cooper'. La misma regla que los logos."""
    limpio = unicodedata.normalize("NFD", (valor or "").strip().lower())
    limpio = "".join(c for c in limpio if unicodedata.category(c) != "Mn")
    for signo in "&.'/":
        limpio = limpio.replace(signo, " ")
    return "-".join(limpio.replace("_", " ").replace("-", " ").split())


@lru_cache(maxsize=1)
def catalogo() -> list[dict]:
    """Las marcas, tal cual están en el archivo.

    Se lee una vez: son cuatrocientas y no cambian mientras corre el
    servidor. Si se edita el archivo hay que reiniciar, que es lo mismo
    que pasa con cualquier otro dato de arranque.
    """
    if not DATOS.is_file():
        return []
    return json.loads(DATOS.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def por_id() -> dict[str, dict]:
    return {m["id"]: m for m in catalogo()}


# Formas de escribir una marca que no salen de aplicar `slug` a su nombre.
# Casi todas son un modelo usado como marca —"Mini Cooper" es un Mini— o
# una separacion de mas. Se resuelven aqui y no en el catalogo para que la
# lista siga teniendo una entrada por marca.
ALIAS = {
    "mc-laren": "mclaren",
    "mini-cooper": "mini",
    "vw": "volkswagen",
    "mercedes": "mercedes-benz",
    "merc": "mercedes-benz",
    "amg": "mercedes-amg",
    "alfa": "alfa-romeo",
    "land-rover-range-rover": "land-rover",
    "range-rover": "land-rover",
    "rolls": "rolls-royce",
    "aston": "aston-martin",
    "chevy": "chevrolet",
    "vocho": "volkswagen",
    "gwm": "great-wall",
    "byd-auto": "byd",
    "great-wall-motors": "great-wall",
    "harley": "harley-davidson",
    "bmw-motorrad": "bmw-motorrad",
    "ktm-racing": "ktm",
    "moto-guzzi": "moto-guzzi",
    "royal-enfield": "royal-enfield",
    "seat-cupra": "cupra",
}


def _resolver(marca: Optional[str]) -> Optional[dict]:
    ident = slug(marca)
    ident = ALIAS.get(ident, ident)
    return por_id().get(ident)


def existe(marca: Optional[str]) -> bool:
    return bool(marca) and _resolver(marca) is not None


def normalizar(marca: Optional[str]) -> Optional[str]:
    """El nombre canónico de una marca escrita de cualquier manera.

    "bmw", "BMW" y "Bmw" devuelven los tres "BMW". None si no está en el
    catálogo: el que llama decide si eso es un error o un dato a limpiar.
    """
    entrada = _resolver(marca)
    return entrada["nombre"] if entrada else None


def _logo_de(ident: str) -> str:
    """La ruta pública del logo de esa marca, o vacío si no lo hay.

    Relativa y no absoluta: la usa el panel por HTTP. Los gráficos siguen
    pidiéndola por su lado con brand_logo_url(), que la devuelve absoluta
    porque CasparCG abre las plantillas con file:// y una ruta relativa no
    tendría contra qué resolverse.
    """
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".avif"):
        archivo = CARPETA_LOGOS / f"{ident}{ext}"
        if archivo.is_file():
            return f"/public/marcas/{archivo.name}?v={int(archivo.stat().st_mtime)}"
    return ""


def listar(tipo: Optional[str] = None) -> list[dict]:
    """El catálogo con el logo de cada marca ya resuelto.

    El logo se mira en disco en cada llamada y no se cachea con el
    catálogo: se suben logos nuevos mientras el servidor corre, y una
    marca que acaba de recibir el suyo tiene que enseñarlo sin reiniciar.
    """
    marcas = catalogo()

    if tipo in TIPOS:
        marcas = [m for m in marcas if tipo in m["tipos"]]

    return [{**m, "logo_url": _logo_de(m["id"])} for m in marcas]


def guardar_logo(ident: str, contenido: bytes, nombre: str) -> str:
    """Guarda el logo de una marca y devuelve su ruta pública.

    Se convierte a PNG con transparencia, igual que el logo del cliente:
    los gráficos lo ponen sobre paneles oscuros y un JPG llegaría con su
    fondo blanco recortado en un rectángulo, como un parche.

    El archivo se llama como el identificador de la marca, que es lo que
    hace que lo encuentren tanto el panel como los gráficos.
    """
    from fastapi import HTTPException
    from PIL import Image, UnidentifiedImageError

    if ident not in por_id():
        raise HTTPException(404, f"'{ident}' no es una marca del catálogo")

    if not contenido:
        raise HTTPException(400, "El archivo llegó vacío")

    try:
        imagen = Image.open(io.BytesIO(contenido))
        imagen.load()
    except (UnidentifiedImageError, OSError) as e:
        raise HTTPException(400, f"'{nombre}' no se pudo leer como imagen ({e})")

    CARPETA_LOGOS.mkdir(parents=True, exist_ok=True)

    # Se borran los que hubiera con otra extensión: si quedara un .jpg
    # viejo junto al .png nuevo, cuál gana dependería del orden del disco.
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".avif"):
        anterior = CARPETA_LOGOS / f"{ident}{ext}"
        if anterior.is_file():
            anterior.unlink()

    imagen.convert("RGBA").save(CARPETA_LOGOS / f"{ident}.png", format="PNG")

    # La version para fondo oscuro que usan los graficos, lista desde ya:
    # asi el primer grafico con esta marca no espera a calcularla.
    from src.services.logos_oscuros import asegurar

    asegurar(CARPETA_LOGOS / f"{ident}.png")

    return _logo_de(ident)
