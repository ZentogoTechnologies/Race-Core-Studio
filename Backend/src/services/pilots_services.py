from beanie import Link # <- FALTABA ESTE
from src.models.pilots_model import Pilot
from src.models.categories_model import Category
from src.schemas.pilots_schemas import PilotCreate, PilotUpdate, PilotResponse
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
            categories = await Category.find(Category.category_id.in_(data.category_ids)).to_list()
            if len(categories)!= len(data.category_ids):
                found_ids = [c.category_id for c in categories]
                missing = set(data.category_ids) - set(found_ids)
                raise HTTPException(status_code=404, detail=f"Categorías no encontradas: {missing}")
            categories_links = [Link(Category, c.id) for c in categories]

        pilot = Pilot(
            **data.model_dump(exclude={"category_ids"}),
            categories=categories_links
        )
        await pilot.insert()
        return await self._build_response(pilot)

    async def get_all_pilots(self, discipline: str = None, category_id: str = None) -> list[PilotResponse]: # <- str
        query = {}
        if discipline:
            query["discipline"] = discipline

        pilots = await Pilot.find(query).to_list()

        # Si filtran por category_id, filtramos en memoria porque categories es Link
        if category_id:
            cat_id_int = int(category_id) # <- convertimos porque en DB es int
            filtered = []
            for p in pilots:
                await p.fetch_all_links()
                if any(c.category_id == cat_id_int for c in p.categories):
                    filtered.append(p)
            pilots = filtered

        return [await self._build_response(p) for p in pilots]

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
            categories = await Category.find(Category.category_id.in_(update_data["category_ids"])).to_list()
            if len(categories)!= len(update_data["category_ids"]):
                found_ids = [c.category_id for c in categories]
                missing = set(update_data["category_ids"]) - set(found_ids)
                raise HTTPException(status_code=404, detail=f"Categorías no encontradas: {missing}")
            update_data["categories"] = [Link(Category, c.id) for c in categories]
            del update_data["category_ids"]

        await pilot.update({"$set": update_data})
        await pilot.reload()
        return await self._build_response(pilot)

    async def delete_pilot(self, pilot_id: str) -> dict: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        # Opcional: validar que no esté asignado a un Vehicle
        await pilot.delete()
        return {"detail": "Piloto eliminado"}