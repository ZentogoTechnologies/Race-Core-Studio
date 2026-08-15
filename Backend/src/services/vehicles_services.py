from src.models.vehicles_model import Vehicle
from src.models.pilots_model import Pilot
from src.models.categories_model import Category
from src.schemas.vehicles_schemas import VehicleCreate, VehicleUpdate, VehicleResponse
from fastapi import HTTPException

class VehicleService:
    async def _build_response(self, vehicle: Vehicle) -> VehicleResponse:
        await vehicle.fetch_all_links() # resuelve pilots
        category = await Category.find_one(Category.category_id == vehicle.category_id)

        pilots_data = []
        for p in vehicle.pilots:
            pilots_data.append({
                "pilot_id": p.pilot_id,
                "name": f"{p.name} {p.last_name}",
                "team_brand": p.team_brand
            })

        sub_name = None
        cat_name = category.category_name if category else None
        if category and vehicle.sub_category_id:
            sub = next((sc for sc in category.sub_categories if sc.sub_category_id == vehicle.sub_category_id), None)
            sub_name = sub.sub_category_name if sub else None

        return VehicleResponse(
            id=str(vehicle.id),
            vehicle_id=vehicle.vehicle_id,
            number=vehicle.number,
            brand=vehicle.brand,
            model=vehicle.model,
            color=vehicle.color,
            pilots=pilots_data,
            category_id=vehicle.category_id,
            category_name=cat_name,
            sub_category_id=vehicle.sub_category_id,
            sub_category_name=sub_name,
            is_active=vehicle.is_active
        )

    async def create_vehicle(self, data: VehicleCreate) -> VehicleResponse:
        # 1. Validar max 2 pilotos
        if len(data.pilot_ids) > 2:
            raise HTTPException(status_code=400, detail="Un vehículo solo puede tener máximo 2 pilotos")

        # 2. Validar que la categoría exista
        category = await Category.find_one(Category.category_id == data.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        # 3. Validar que la sub_category exista dentro de esa category
        if data.sub_category_id:
            sub_exists = any(sc.sub_category_id == data.sub_category_id for sc in category.sub_categories)
            if not sub_exists:
                raise HTTPException(status_code=400, detail=f"sub_category_id {data.sub_category_id} no pertenece a category {data.category_id}")

        # 4. Buscar los pilotos y convertirlos a Link
        pilots_links = []
        for pid in data.pilot_ids:
            pilot = await Pilot.find_one(Pilot.pilot_id == pid)
            if not pilot:
                raise HTTPException(status_code=404, detail=f"Piloto con id {pid} no encontrado")
            pilots_links.append(pilot)

        vehicle = Vehicle(
            **data.model_dump(exclude={"pilot_ids"}),
            pilots=pilots_links
        )
        await vehicle.insert()
        return await self._build_response(vehicle)

    async def get_all_vehicles(self, discipline: str = None, category_id: str = None) -> list[VehicleResponse]: # <- str
        categories = []
        if discipline:
            categories = await Category.find(Category.discipline == discipline).to_list()
            category_ids = [c.category_id for c in categories]
            vehicles = await Vehicle.find(Vehicle.category_id.in_(category_ids)).to_list()
        else:
            query = {}
            if category_id:
                query["category_id"] = int(category_id) # <- convertimos porque en DB es int
            vehicles = await Vehicle.find(query).to_list()

        return [await self._build_response(v) for v in vehicles]

    async def get_vehicle_by_id(self, vehicle_id: str) -> VehicleResponse: # <- str
        vehicle = await Vehicle.find_one(Vehicle.vehicle_id == int(vehicle_id)) # <- int
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado")
        return await self._build_response(vehicle)

    async def update_vehicle(self, vehicle_id: str, data: VehicleUpdate) -> VehicleResponse: # <- FALTABA ESTE MÉTODO
        vehicle = await Vehicle.find_one(Vehicle.vehicle_id == int(vehicle_id))
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado")

        update_data = data.model_dump(exclude_unset=True)

        # Si cambian pilotos
        if "pilot_ids" in update_data:
            if len(update_data["pilot_ids"]) > 2:
                raise HTTPException(status_code=400, detail="Un vehículo solo puede tener máximo 2 pilotos")
            pilots_links = []
            for pid in update_data["pilot_ids"]:
                pilot = await Pilot.find_one(Pilot.pilot_id == pid)
                if not pilot:
                    raise HTTPException(status_code=404, detail=f"Piloto con id {pid} no encontrado")
                pilots_links.append(pilot)
            update_data["pilots"] = pilots_links
            del update_data["pilot_ids"]

        # Si cambian category o sub_category validar
        if "category_id" in update_data or "sub_category_id" in update_data:
            cat_id = update_data.get("category_id", vehicle.category_id)
            sub_id = update_data.get("sub_category_id", vehicle.sub_category_id)
            category = await Category.find_one(Category.category_id == cat_id)
            if not category:
                raise HTTPException(status_code=404, detail="Categoría no encontrada")
            if sub_id:
                sub_exists = any(sc.sub_category_id == sub_id for sc in category.sub_categories)
                if not sub_exists:
                    raise HTTPException(status_code=400, detail=f"sub_category_id {sub_id} no pertenece a category {cat_id}")

        await vehicle.update({"$set": update_data})
        await vehicle.reload()
        return await self._build_response(vehicle)

    async def delete_vehicle(self, vehicle_id: str) -> dict: # <- FALTABA ESTE MÉTODO
        vehicle = await Vehicle.find_one(Vehicle.vehicle_id == int(vehicle_id))
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado")
        await vehicle.delete()
        return {"detail": "Vehículo eliminado"}