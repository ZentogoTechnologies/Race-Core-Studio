from beanie import Document, Link
from typing import Optional, List
from src.models.pilots_model import Pilot

class Vehicle(Document):
    vehicle_id: int
    number: int # dorsal
    brand: Optional[str] = None # Marca del carro/moto: "Porsche", "Yamaha"
    model: Optional[str] = None # "911 GT3 Cup", "R1"
    color: Optional[str] = None

    pilots: List[Link[Pilot]] = [] # Hasta 2 pilotos. Sin principal
    category_id: int
    sub_category_id: Optional[int] = None

    is_active: bool = True

    class Settings:
        name = "vehicles"
        indexes = [
            "vehicle_id",
            "number",
            "category_id"
        ]