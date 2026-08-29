from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Sobre de los listados.

    `total` es el conteo con los filtros aplicados pero sin paginar: es lo
    que necesita el frontend para saber cuántas páginas dibujar. `limit` en
    None significa que se pidió la lista completa.
    """

    items: list[T]
    total: int
    skip: int = 0
    limit: Optional[int] = None
