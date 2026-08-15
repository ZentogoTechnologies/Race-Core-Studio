from beanie import Document, Link
from typing import Optional, List
from src.models.categories_model import Category

class Pilot(Document):
    pilot_id: int
    name: str
    last_name: str
    nationality: Optional[str] = None
    team_brand: Optional[str] = None # "Zentogo Racing" - para mostrar en grilla/fichas
    categories: List[Link[Category]] = []
    discipline: List[str] = [] # ["circuito", "drag"]
    is_active: bool = True

    class Settings:
        name = "pilots"
        indexes = [
            "pilot_id"
        ]