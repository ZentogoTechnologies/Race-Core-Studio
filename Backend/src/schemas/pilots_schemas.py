from pydantic import BaseModel, Field
from typing import Optional, List

class PilotCreate(BaseModel):
    pilot_id: int
    name: str
    last_name: str
    nationality: Optional[str] = None
    team_brand: Optional[str] = None # "Zentogo Racing"
    category_ids: List[int] = [] # Recibimos IDs. En el service buscamos Category y hacemos Link
    discipline: List[str] = [] # ["circuito", "drag"]

class PilotUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    nationality: Optional[str] = None
    team_brand: Optional[str] = None
    category_ids: Optional[List[int]] = None
    discipline: Optional[List[str]] = None

class PilotResponse(BaseModel):
    id: str = Field(alias="_id")
    pilot_id: int
    name: str
    last_name: str
    nationality: Optional[str] = None
    team_brand: Optional[str] = None
    categories: List[str] = [] # Aquí devolvemos solo los category_id para no hacer fetch pesado
    discipline: List[str] = []
    is_active: bool

    class Config:
        populate_by_name = True