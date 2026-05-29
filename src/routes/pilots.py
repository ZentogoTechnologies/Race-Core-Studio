from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
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
def create_pilot(
    pilotName: str = Form(...),
    pilotStatus: bool = Form(True),
    pilotCountry: Optional[str] = Form(None),
    pilotTeamName: Optional[str] = Form(None),
    pilotPhotoPath: Optional[str] = Form(None),
    pilotSocialHandle: Optional[str] = Form(None),
    pilotBiography: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    new_pilot = PilotModel(
        pilotName=pilotName,
        pilotStatus=pilotStatus,
        pilotCountry=pilotCountry,
        pilotTeamName=pilotTeamName,
        pilotPhotoPath=pilotPhotoPath,
        pilotSocialHandle=pilotSocialHandle,
        pilotBiography=pilotBiography
    )
    db.add(new_pilot)
    db.commit()
    db.refresh(new_pilot)
    return new_pilot

# 2. OBTENER TODOS LOS PILOTOS ACTIVOS (READ ALL)
@pilots.get("/pilots", response_model=List[Pilot])
def get_all_pilots(db: Session = Depends(get_db)):
    active_pilots = db.query(PilotModel).filter(PilotModel.pilotStatus == True).all()
    return active_pilots

# 3. OBTENER UN PILOTO ESPECÍFICO (READ ONE)
@pilots.get("/pilots/{pilotId}", response_model=Pilot)
def get_pilot(pilotId: int, db: Session = Depends(get_db)):
    pilot = db.query(PilotModel).filter(PilotModel.pilotId == pilotId).first()
    if not pilot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piloto no encontrado")
    return pilot

# 4. ACTUALIZAR UN PILOTO (UPDATE)
@pilots.put("/pilots/{pilotId}", response_model=Pilot)
def update_pilot(pilotId: int, pilot_data: Pilot, db: Session = Depends(get_db)):
    pilot = db.query(PilotModel).filter(PilotModel.pilotId == pilotId).first()
    if not pilot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piloto no encontrado")
    
    pilot.pilotName = pilot_data.pilotName
    pilot.pilotStatus = pilot_data.pilotStatus
    pilot.pilotCountry = pilot_data.pilotCountry
    pilot.pilotTeamName = pilot_data.pilotTeamName
    pilot.pilotPhotoPath = pilot_data.pilotPhotoPath
    pilot.pilotSocialHandle = pilot_data.pilotSocialHandle
    pilot.pilotBiography = pilot_data.pilotBiography

    db.commit()
    db.refresh(pilot)
    return pilot

# 5. ELIMINAR UN PILOTO (SOFT DELETE)
@pilots.delete("/pilots/{pilotId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pilot(pilotId: int, db: Session = Depends(get_db)):
    pilot = db.query(PilotModel).filter(PilotModel.pilotId == pilotId).first()
    if not pilot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piloto no encontrado")
    
    # Soft delete: solo lo marcamos como inactivo
    pilot.pilotStatus = False
    db.commit()
    return {"message": "Piloto archivado exitosamente"}