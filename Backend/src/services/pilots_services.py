from typing import Optional

from beanie.operators import In
from src.models.pilots_model import Pilot
from src.models.categories_model import Category
from src.schemas.pilots_schemas import PilotCreate, PilotUpdate, PilotResponse
from src.schemas.common_schemas import Page
from src.services.pagination import (
    campo_orden, combinar, direccion, filtro_busqueda,
)
from fastapi import HTTPException

class PilotService:
    async def _build_response(self, pilot: Pilot) -> PilotResponse:
        await pilot.fetch_all_links() # resuelve categories

        categories_data = [c.category_id for c in pilot.categories]

        return PilotResponse(
            id=str(pilot.id),
            pilot_id=pilot.pilot_id,
            name=pilot.name,
            last_name=pilot.last_name,
            nationality=pilot.nationality,
            team_brand=pilot.team_brand,
            photo=pilot.photo,
            categories=categories_data,
            discipline=pilot.discipline,
            is_active=pilot.is_active
        )

    async def create_pilot(self, data: PilotCreate) -> PilotResponse:
        # 1. Validar que no exista el pilot_id
        exists = await Pilot.find_one(Pilot.pilot_id == data.pilot_id)
        if exists:
            raise HTTPException(status_code=400, detail="pilot_id ya existe")

        # 2. Buscar las categories y convertirlas a Link
        categories_links = []
        if data.category_ids:
            categories = await Category.find(In(Category.category_id, data.category_ids)).to_list()
            if len(categories)!= len(data.category_ids):
                found_ids = [c.category_id for c in categories]
                missing = set(data.category_ids) - set(found_ids)
                raise HTTPException(status_code=404, detail=f"Categorías no encontradas: {missing}")
            categories_links = list(categories)  # Beanie los convierte a Link al guardar

        pilot = Pilot(
            **data.model_dump(exclude={"category_ids"}),
            categories=categories_links
        )
        await pilot.insert()
        return await self._build_response(pilot)

    # Campos por los que se deja ordenar. La lista es blanca a propósito:
    # sort_by llega del cliente y termina en el sort de Mongo.
    ORDENABLES = {"pilot_id", "name", "last_name", "nationality", "team_brand"}
    BUSCABLES = ["name", "last_name", "nationality", "team_brand"]

    async def get_all_pilots(
        self,
        discipline: Optional[str] = None,
        category_id: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_dir: Optional[str] = None,
        skip: int = 0,
        limit: Optional[int] = None,
    ) -> Page[PilotResponse]:
        filtros = [
            {"discipline": discipline} if discipline else None,
            filtro_busqueda(search, self.BUSCABLES),
        ]

        # El filtro por categoría se resuelve contra el DBRef guardado, no
        # trayendo todos los pilotos y descartando en memoria: con eso la
        # paginación tendría que ocurrir después de leer la colección entera.
        if category_id:
            categoria = await Category.find_one(Category.category_id == int(category_id))
            if not categoria:
                return Page(items=[], total=0, skip=skip, limit=limit)
            filtros.append({"categories.$id": categoria.id})

        query = combinar(*filtros)

        total = await Pilot.find(query).count()

        consulta = Pilot.find(query).sort(
            (campo_orden(sort_by, self.ORDENABLES, "last_name"), direccion(sort_dir))
        ).skip(skip)

        # limit=None es "tráeme todo": lo usa el panel de gráficos, que
        # necesita la lista completa para el selector de pilotos.
        if limit is not None:
            consulta = consulta.limit(limit)

        pilots = await consulta.to_list()

        return Page(
            items=[await self._build_response(p) for p in pilots],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def get_pilot_by_id(self, pilot_id: str) -> PilotResponse: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int porque en DB es int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")
        return await self._build_response(pilot)

    async def update_pilot(self, pilot_id: str, data: PilotUpdate) -> PilotResponse: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        update_data = data.model_dump(exclude_unset=True) # <- model_dump

        # Si vienen category_ids nuevos, los convertimos a Link
        if "category_ids" in update_data:
            categories = await Category.find(In(Category.category_id, update_data["category_ids"])).to_list()
            if len(categories)!= len(update_data["category_ids"]):
                found_ids = [c.category_id for c in categories]
                missing = set(update_data["category_ids"]) - set(found_ids)
                raise HTTPException(status_code=404, detail=f"Categorías no encontradas: {missing}")
            update_data["categories"] = list(categories)  # Beanie los convierte a Link
            del update_data["category_ids"]

        for campo, valor in update_data.items():
            setattr(pilot, campo, valor)

        # save() y no update({"$set": ...}): solo al guardar el documento
        # Beanie convierte los Document en Link. Con $set se incrustaba el
        # documento completo y la relacion se perdia.
        await pilot.save()
        return await self._build_response(pilot)

    async def delete_pilot(self, pilot_id: str) -> dict: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        # Opcional: validar que no esté asignado a un Vehicle
        await pilot.delete()
        return {"detail": "Piloto eliminado"}