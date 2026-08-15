from beanie import Document
from typing import Optional, List
from pydantic import BaseModel

class SubCategoryEmbedded(BaseModel): # BaseModel porque va dentro
    sub_category_id: int
    sub_category_name: str

class Category(Document):
    category_id: int
    category_name: str
    discipline: str # "circuito" o "drag"
    sub_categories: List[SubCategoryEmbedded] = [] # Embebido con id + nombre
    description: Optional[str] = None

    class Settings:
        name = "categories"