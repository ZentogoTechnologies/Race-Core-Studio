from pydantic import BaseModel, Field
from typing import List, Optional

class SubCategoryEmbedded(BaseModel): # mismo nombre que en el model
    sub_category_id: int
    sub_category_name: str

class CategoryCreate(BaseModel):
    category_id: int
    category_name: str
    discipline: str # "circuito" o "drag"
    sub_categories: List[SubCategoryEmbedded] = []
    description: Optional[str] = None

class CategoryUpdate(BaseModel): # para PUT/PATCH
    category_name: Optional[str] = None
    discipline: Optional[str] = None
    sub_categories: Optional[List[SubCategoryEmbedded]] = None
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str = Field(alias="_id") # Beanie te devuelve _id como ObjectId
    category_id: int
    category_name: str
    discipline: str
    sub_categories: List[SubCategoryEmbedded]
    description: Optional[str] = None

    class Config:
        populate_by_name = True # para que acepte _id y lo mapee a id