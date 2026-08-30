from datetime import date
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

# Tipos de sesión de una jornada. La práctica libre no es un tipo aparte:
# es una práctica marcada como `libre`, porque en pista se sigue llamando
# práctica y solo cambia que corren varias categorías juntas.
TIPOS_SESION = ("practice", "qualy", "heat")


class Inscrito(BaseModel):
    """Un vehículo del evento con quién lo maneja.

    La categoría y la subcategoría se copian del vehículo al inscribirlo.
    Se guardan aquí a propósito: si mañana el carro cambia de categoría,
    el evento pasado debe seguir contando lo que ocurrió ese fin de
    semana, no lo que dice la ficha hoy.
    """

    vehicle_id: int
    pilot_ids: List[int] = []          # uno o dos, según el vehículo
    category_id: int
    sub_category_id: Optional[int] = None


class Sesion(BaseModel):
    """Una práctica, clasificación o carrera dentro de un día."""

    numero_orden: int                  # posición dentro del evento, para ordenar
    dia: str                           # YYYY-MM-DD, dentro del rango del evento
    tipo: str                          # practice | qualy | heat

    # Normalmente una categoría. La práctica libre lleva varias porque
    # salen juntas a pista.
    category_ids: List[int] = []
    libre: bool = False

    # Se calcula al crearla contando las que ya hay de ese tipo y esa
    # categoría en el evento: si ya existe Practice 1 de TCR, la siguiente
    # es la 2 aunque sea otro día.
    numero: int = 1
    nombre: str = ""                   # "Practice 2 · TCR", ya resuelto

    # Subconjunto de los inscritos que sale en esta sesión. Vacío significa
    # todos los de la categoría: es lo normal, y evita tener que marcar
    # veinte carros en cada práctica.
    vehicle_ids: List[int] = []


class Event(Document):
    event_id: int
    name: str

    # Texto YYYY-MM-DD y no un tipo fecha: Mongo no tiene "solo fecha" y
    # guardarlas como datetime arrastra una hora inventada que estropea
    # las comparaciones por día. Así ordena bien y es lo que manda el
    # <input type="date"> del formulario.
    start_date: str
    end_date: str

    discipline: str = "circuito"       # para el selector global
    location: Optional[str] = None

    category_ids: List[int] = []
    inscritos: List[Inscrito] = []
    sesiones: List[Sesion] = []

    is_active: bool = True

    @property
    def dias(self) -> List[str]:
        """Los días del evento, ambos extremos incluidos."""
        inicio = date.fromisoformat(self.start_date)
        fin = date.fromisoformat(self.end_date)
        total = (fin - inicio).days
        return [
            (date.fromordinal(inicio.toordinal() + i)).isoformat()
            for i in range(total + 1)
        ]

    class Settings:
        name = "events"
        indexes = [
            IndexModel([("event_id", ASCENDING)], unique=True),
            IndexModel([("start_date", ASCENDING)]),
            IndexModel([("discipline", ASCENDING)]),
        ]
