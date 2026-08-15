from fastapi import APIRouter, Depends, HTTPException, status, Form
<<<<<<< HEAD

pilots = APIRouter()

@pilots.get("/pilots", tags=["Pilots"])
def get_pilots():
    return {"response": "pilots on route"}
=======
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

# 1. CREAR UN PILOTO (CREATE) - VERSIÓN FORMULARIO
@pilots.post("/pilots", response_model=Pilot, status_code=status.HTTP_201_CREATED)
def post_pilot():
    return 'post_pilot'

# 2. OBTENER TODOS LOS PILOTOS ACTIVOS (READ ALL)
@pilots.get("/pilots", response_model=List[Pilot])
def get_pilots():
    return 'get_pilots'

# 3. OBTENER UN PILOTO ESPECÍFICO (READ ONE)
@pilots.get("/pilots/{pilotId}", response_model=Pilot)
def get_pilot():
    return 'get_pilot'

# 4. ACTUALIZAR UN PILOTO (UPDATE)
@pilots.put("/pilots/{pilotId}", response_model=Pilot)
def delete_pilot():
    return 'delte_pilot'

# 5. ELIMINAR UN PILOTO (SOFT DELETE)
@pilots.delete("/pilots/{pilotId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pilot():
    return 'delete_pilot'
>>>>>>> main
