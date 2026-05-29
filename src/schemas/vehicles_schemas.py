from pydantic import BaseModel
from typing import Optional, List

class VehicleRequest(BaseModel):
    vehicleId: int

class Vehicle(BaseModel):
    vehicleId: int
    vehicleBrand: str                       # Ej: McLaren, Porsche
    vehicleBrandLogo: Optional[str] = None 
    vehicleModel: Optional[str] = None      #Ej: 720S, 911 GT3
    vehicleNumber: str                      # Usamos str porque a veces los números tienen letras (Ej: 7A)
    vehicleStatus: bool                     # Para el soft delete
    vehicleCategoryId: int                  # Llave foránea para relacionar con el módulo de Categorías