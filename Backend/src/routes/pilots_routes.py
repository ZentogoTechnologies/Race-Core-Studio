from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from typing import Optional
from src.services.pilots_services import PilotService
from src.schemas.pilots_schemas import PilotCreate, PilotUpdate, PilotResponse
from src.schemas.common_schemas import Page
from src.services.auth_services import puede_escribir

pilots = APIRouter()
service = PilotService()

@pilots.get("/", tags=["Pilots"], response_model=Page[PilotResponse])
async def get_pilots(
    discipline: Optional[str] = Query(None, description="Filtrar por disciplina: circuito o drag"),
    category_id: Optional[str] = Query(None, description="Filtrar pilotos de una categoría"), # <- str no int
    search: Optional[str] = Query(None, description="Búsqueda parcial, sin distinguir mayúsculas"),
    is_active: Optional[bool] = Query(None, description="true solo activos, false solo inactivos, vacío todos"),
    sort_by: Optional[str] = Query(None, description="Campo por el que ordenar"),
    sort_dir: Optional[str] = Query("asc", description="asc o desc"),
    skip: int = Query(0, ge=0, description="Cuántos registros saltar"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Tamaño de página. Sin valor devuelve todo"),
):
    """
    Obtiene los pilotos paginados.
    Puedes filtrar por disciplina, categoría o texto libre.
    Ordena por: pilot_id, name, last_name, nationality, team_brand
    """
    return await service.get_all_pilots(
        discipline=discipline, category_id=category_id, search=search,
        sort_by=sort_by, sort_dir=sort_dir, skip=skip, limit=limit,
        is_active=is_active,
    )

@pilots.post("/", tags=["Pilots"], response_model=PilotResponse, status_code=201, dependencies=[Depends(puede_escribir)])
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

@pilots.put("/{pilot_id}", tags=["Pilots"], response_model=PilotResponse, dependencies=[Depends(puede_escribir)])
async def update_pilot(pilot_id: str, data: PilotUpdate): # <- str no int
    """
    Actualiza un piloto.
    Si envías category_ids se re-validan contra la DB
    """
    pilot = await service.update_pilot(pilot_id, data)
    if not pilot:
        raise HTTPException(status_code=404, detail="Piloto no encontrado")
    return pilot

@pilots.delete("/{pilot_id}", tags=["Pilots"], dependencies=[Depends(puede_escribir)])
async def delete_pilot(pilot_id: str): # <- str no int
    """
    Elimina un piloto
    """
    deleted = await service.delete_pilot(pilot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Piloto no encontrado")
    return {"message": "Piloto eliminado"}


# ======================================================================
#  FOTO
#
#  El fichero va al disco y en la base queda solo su ruta. Guardar la
#  imagen dentro del documento obligaría a arrastrarla en cada listado de
#  pilotos, y las plantillas de CasparCG piden la foto por URL, que es
#  como ya se sirven las que hay.
# ======================================================================


class RutaFoto(BaseModel):
    ruta: str


@pilots.post("/{pilot_id}/foto", tags=["Pilots"], response_model=PilotResponse,
             dependencies=[Depends(puede_escribir)])
async def subir_foto(pilot_id: str, archivo: UploadFile = File(...)):
    """
    Sube la foto del piloto desde el navegador
    """
    contenido = await archivo.read()
    return await service.subir_foto(pilot_id, archivo.filename or "", contenido)


@pilots.put("/{pilot_id}/foto", tags=["Pilots"], response_model=PilotResponse,
            dependencies=[Depends(puede_escribir)])
async def foto_por_ruta(pilot_id: str, datos: RutaFoto):
    """
    Toma la foto de una ruta del servidor y la copia a public/pilotos
    """
    return await service.foto_por_ruta(pilot_id, datos.ruta)


@pilots.post("/{pilot_id}/foto/sin-fondo", tags=["Pilots"],
             response_model=PilotResponse,
             dependencies=[Depends(puede_escribir)])
async def quitar_fondo(pilot_id: str):
    """
    Recorta al piloto de su fondo y reemplaza la foto que ya tiene.

    Tarda unos segundos la primera vez del día, que es lo que cuesta
    cargar el modelo; después es casi inmediato.
    """
    return await service.quitar_fondo(pilot_id)


@pilots.delete("/{pilot_id}/foto", tags=["Pilots"], response_model=PilotResponse,
               dependencies=[Depends(puede_escribir)])
async def borrar_foto(pilot_id: str):
    """
    Quita la foto. El gráfico vuelve a la silueta de reserva
    """
    return await service.borrar_foto(pilot_id)
