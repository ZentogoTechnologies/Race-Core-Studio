from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from src.schemas.common_schemas import Page
from src.schemas.events_schemas import (
    EventCreate, EventResponse, EventUpdate, SesionIn,
)
from src.services.auth_services import puede_escribir
from src.services.events_services import EventService

events = APIRouter()
service = EventService()


@events.get("/", tags=["Events"], response_model=Page[EventResponse])
async def get_events(
    discipline: Optional[str] = Query(None, description="circuito o drag"),
    search: Optional[str] = Query(None, description="Búsqueda por nombre o sede"),
    sort_by: Optional[str] = Query(None, description="event_id, name, start_date, end_date"),
    sort_dir: Optional[str] = Query("asc", description="asc o desc"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200),
):
    """
    Lista los eventos paginados, con sus categorías, inscritos y sesiones
    """
    return await service.get_events(
        discipline=discipline, search=search, sort_by=sort_by,
        sort_dir=sort_dir, skip=skip, limit=limit,
    )


@events.post("/", tags=["Events"], response_model=EventResponse, status_code=201,
             dependencies=[Depends(puede_escribir)])
async def create_event(data: EventCreate):
    """
    Crea un evento. El event_id lo asigna el servidor si no se manda
    """
    return await service.create_event(data)


@events.get("/{event_id}", tags=["Events"], response_model=EventResponse)
async def get_event_by_id(event_id: str):
    """
    Obtiene un evento con todo su detalle
    """
    evento = await service.get_event_by_id(event_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Event Not Found!")
    return evento


@events.put("/{event_id}", tags=["Events"], response_model=EventResponse,
            dependencies=[Depends(puede_escribir)])
async def update_event(event_id: str, data: EventUpdate):
    """
    Actualiza un evento
    """
    evento = await service.update_event(event_id, data)
    if not evento:
        raise HTTPException(status_code=404, detail="Event Not Found!")
    return evento


@events.delete("/{event_id}", tags=["Events"], dependencies=[Depends(puede_escribir)])
async def delete_event(event_id: str):
    """
    Elimina un evento
    """
    if not await service.delete_event(event_id):
        raise HTTPException(status_code=404, detail="Event Not Found!")
    return {"message": "Event deleted"}


@events.post("/{event_id}/sesiones", tags=["Events"], response_model=EventResponse,
             status_code=201, dependencies=[Depends(puede_escribir)])
async def add_session(event_id: str, data: SesionIn):
    """
    Agrega una sesión a un día del evento.

    El número se calcula solo: si ya hay Practice 1 de TCR, la siguiente
    es Practice 2 aunque sea otro día
    """
    evento = await service.add_session(event_id, data)
    if not evento:
        raise HTTPException(status_code=404, detail="Event Not Found!")
    return evento


@events.delete("/{event_id}/sesiones/{numero_orden}", tags=["Events"],
               response_model=EventResponse, dependencies=[Depends(puede_escribir)])
async def delete_session(event_id: str, numero_orden: int):
    """
    Quita una sesión del evento
    """
    evento = await service.delete_session(event_id, numero_orden)
    if not evento:
        raise HTTPException(status_code=404, detail="Event Not Found!")
    return evento
