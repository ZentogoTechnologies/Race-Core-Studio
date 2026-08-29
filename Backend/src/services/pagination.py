"""Piezas compartidas por los listados paginados.

La paginación se hace en Mongo, no en memoria: con el ordenamiento y la
búsqueda del lado del cliente solo se ordenaría la página visible, que es
justo lo que hace ver los listados inconsistentes al cambiar de página.
"""

import re
import unicodedata
from typing import Optional

_DIRECCIONES = {"asc": 1, "desc": -1}


def direccion(sort_dir: Optional[str]) -> int:
    """1 o -1 para el sort de Mongo. Cualquier cosa rara sube ascendente."""
    return _DIRECCIONES.get((sort_dir or "asc").lower(), 1)


def campo_orden(sort_by: Optional[str], permitidos: set[str], por_defecto: str) -> str:
    """El nombre del campo llega del cliente y va directo al sort de Mongo,
    así que solo se aceptan los de la lista blanca de cada entidad."""
    return sort_by if sort_by in permitidos else por_defecto


# Cada letra se busca junto con sus variantes acentuadas. Los nombres de
# la base vienen con tilde ("LEÓN", "CASTAÑEDAS") y nadie los escribe así
# en un buscador: sin esto, buscar "leon" no encuentra a "LEÓN".
_EQUIVALENTES = {
    "a": "aáàäâã", "e": "eéèëê", "i": "iíìïî",
    "o": "oóòöôõ", "u": "uúùüû", "n": "nñ", "c": "cç",
}


def _sin_acentos(texto: str) -> str:
    """Descompone y descarta los diacríticos, para que buscar "LEÓN"
    entre por el mismo camino que buscar "leon"."""
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in descompuesto if not unicodedata.combining(c))


def _patron_flexible(texto: str) -> str:
    """Expresión regular que ignora los acentos en los dos sentidos."""
    partes = []

    for caracter in _sin_acentos(texto).lower():
        variantes = _EQUIVALENTES.get(caracter)
        # re.escape sobre el carácter suelto: un punto o un paréntesis en
        # el nombre buscado tiene que valer como literal, no como sintaxis.
        partes.append(f"[{variantes}]" if variantes else re.escape(caracter))

    return "".join(partes)


def filtro_busqueda(texto: Optional[str], campos: list[str]) -> Optional[dict]:
    """Coincidencia parcial sobre varios campos, sin distinguir mayúsculas
    ni acentos."""
    if not texto or not texto.strip():
        return None

    patron = _patron_flexible(texto.strip())
    return {"$or": [{campo: {"$regex": patron, "$options": "i"}} for campo in campos]}


def combinar(*filtros: Optional[dict]) -> dict:
    """Une los filtros que no son None. Si hay más de uno, van con $and para
    que dos `$or` distintos (búsqueda y otra condición) no se pisen."""
    activos = [f for f in filtros if f]

    if not activos:
        return {}
    if len(activos) == 1:
        return activos[0]

    return {"$and": activos}
