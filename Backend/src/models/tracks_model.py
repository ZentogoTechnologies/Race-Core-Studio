from typing import Optional

from beanie import Document
from pydantic import Field


class Trazado(Document):
    """Un trazado de pista con su imagen.

    No es "la imagen del circuito" sino una lista: el mismo autódromo puede
    correrse de varias formas —la pista corta, la larga cuando se amplíe, el
    cuarto de milla para drag— y cada una tiene su dibujo. El gráfico saca
    el que esté marcado como activo.

    Nada de esto lleva Panamá dentro: el nombre del autódromo es un campo
    más, para que el software sirva en cualquier circuito.
    """

    trazado_id: int = Field(..., description="Correlativo, lo asigna el servicio")

    # Lo que se lee grande en el arte. El nombre del autódromo o del circuito.
    name: str

    # La línea pequeña de encima: "Pista corta · 2.5 km", "Cuarto de milla".
    # Es lo que distingue un trazado de otro dentro del mismo recinto.
    variante: Optional[str] = None

    # Para poder ofrecer primero los que corresponden a lo que se está
    # corriendo. Mismos valores que el selector de la interfaz.
    discipline: str = "circuito"

    length_km: Optional[float] = None

    # Nombre del fichero dentro de la carpeta de trazados de la plantilla.
    # Se guarda solo el nombre y no la ruta: si el proyecto se mueve de
    # carpeta, las imágenes siguen resolviéndose.
    image: Optional[str] = None

    activo: bool = False

    class Settings:
        name = "trazados"
