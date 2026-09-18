from beanie import Document
from typing import Optional, List
from pydantic import BaseModel

class SubCategoryEmbedded(BaseModel): # BaseModel porque va dentro
    sub_category_id: int
    sub_category_name: str

class Category(Document):
    category_id: int
    category_name: str
    discipline: str # "circuit" o "drag"
    sub_categories: List[SubCategoryEmbedded] = [] # Embebido con id + nombre
    description: Optional[str] = None

    # Categoria abierta: la corren todos los vehiculos de la disciplina,
    # sea cual sea la suya. No se escribe en la ficha del carro -ahi sigue
    # estando su clase, "13 seg" o "600 cc"- sino que vale como regla al
    # inscribir.
    #
    # En drag es DragWar: cada carro conserva su clase por tiempo o
    # cilindrada y ademas puede correr el bracket general. Copiarla a cada
    # vehiculo seria repetir en ciento y pico de fichas algo que es cierto
    # para todas.
    base: bool = False

    # Logo del campeonato: TCR, GT Challenge, Fórmula 1. Solo el nombre del
    # archivo; vive en public/categorias. Igual que las demás imágenes, en
    # la base va la referencia y el archivo al disco.
    logo: Optional[str] = None

    class Settings:
        name = "categories"