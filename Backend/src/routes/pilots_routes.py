from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from src.services.pilots_services import PilotService
from src.schemas.pilots_schemas import PilotCreate, PilotUpdate, PilotResponse

pilots = APIRouter()
service = PilotService()

@pilots.get("/", tags=["Pilots"], response_model=list[PilotResponse])
async def get_pilots(
    discipline: Optional[str] = Query(None, description="Filtrar por disciplina: circuito o drag"),
    category_id: Optional[str] = Query(None, description="Filtrar pilotos de una categoría") # <- str no int
):
    """
    Obtiene todos los pilotos.
    Puedes filtrar por disciplina o por category_id.
    """
    return await service.get_all_pilots(discipline=discipline, category_id=category_id)

@pilots.post("/", tags=["Pilots"], response_model=PilotResponse, status_code=201)
async def create_pilot(data: PilotCreate):
    """
    Crea un piloto nuevo.
    Valida que todas las category_ids existan
    """
    return await service.create_pilot(data)

@pilots.get("/{pilot_id}", tags=["Pilots"], response_model=PilotResponse)
async def get_pilot_by_id(pilot_id: str): # <- str no int
    """
    Obtiene un piloto por pilot_id con sus categorías
    """
    pilot = await service.get_pilot_by_id(pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Piloto no encontrado")
    return pilot

@pilots.put("/{pilot_id}", tags=["Pilots"], response_model=PilotResponse)
async def update_pilot(pilot_id: str, data: PilotUpdate): # <- str no int
    """
    Actualiza un piloto.
    Si envías category_ids se re-validan contra la DB
    """
    pilot = await service.update_pilot(pilot_id, data)
    if not pilot:
        raise HTTPException(status_code=404, detail="Piloto no encontrado")
    return pilot

@pilots.delete("/{pilot_id}", tags=["Pilots"])
async def delete_pilot(pilot_id: str): # <- str no int
    """
    Elimina un piloto
    """
    deleted = await service.delete_pilot(pilot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Piloto no encontrado")
    return {"message": "Piloto eliminado"}