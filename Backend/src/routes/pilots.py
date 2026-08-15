from fastapi import APIRouter, Depends, HTTPException, status, Form
from typing import List, Optional

# Importamos la conexión a la base de datos
from src.database.database import get_db

# Importamos el modelo físico de la base de datos (SQLAlchemy)
from src.models.pilot_model import PilotModel

# Importamos los schemas lógicos de Pydantic 
# (NOTA: Asegúrate de que tu archivo dentro de la carpeta schemas se llame "pilot_schema.py", 
# o cambia este nombre por el que le hayas puesto a tu archivo)
from src.schemas.pilots_schemas import Pilot 

pilots = APIRouter()

@pilots.get("/pilots", tags=["Pilots"])
def get_pilots():
    return {"response": "pilots on route"}