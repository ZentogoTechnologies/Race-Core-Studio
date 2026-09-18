from beanie import Document, Link
from typing import Dict, Optional, List
from src.models.categories_model import Category

class Pilot(Document):
    pilot_id: int
    name: str
    last_name: str
    nationality: Optional[str] = None
    # Legado. El equipo vivia aqui cuando un piloto pertenecia a una sola
    # disciplina. Ahora vive en `equipos`; la migracion de arranque lo pasa
    # alli y vacia este campo, que ya no se vuelve a escribir.
    team_brand: Optional[str] = None
    # El equipo de cada disciplina: {"circuito": "Zentogo", "drag": "Candela"}.
    # La persona es la misma, pero con quien corre no: son campeonatos
    # distintos, con otros carros y otros equipos, y el equipo de circuito
    # no dice nada en drag.
    equipos: Dict[str, str] = {}
    photo: Optional[str] = None # ruta relativa dentro de public/, ej "pilotos/prospec-series/1.png"
    categories: List[Link[Category]] = []
    discipline: List[str] = [] # ["circuito", "drag"]
    is_active: bool = True

    class Settings:
        name = "pilots"
        indexes = [
            "pilot_id"
        ]