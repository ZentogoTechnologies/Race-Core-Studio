from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from src.services.categories_services import CategoryService
from src.schemas.categories_schemas import CategoryCreate, CategoryUpdate, CategoryResponse

categories = APIRouter()
service = CategoryService()

@categories.get("/", tags=["Categories"], response_model=list[CategoryResponse])
async def get_categories(
    discipline: Optional[str] = Query(None, description="Filter by discipline: circuit o drag")
):
    """
    Obtiene todas las categorías. Puedes filtrar por disciplina
    """
    return await service.get_categories(discipline=discipline)

@categories.post("/", tags=["Categories"], response_model=CategoryResponse, status_code=201)
async def create_category(data: CategoryCreate):
    """
    Crea una nueva categoría con sus subcategorías
    """
    return await service.create_category(data)

@categories.get("/{category_id}", tags=["Categories"], response_model=CategoryResponse)
async def get_category_by_id(category_id: str):
    """
    Obtiene una categoría por su category_id
    """
    category = await service.get_category_by_id(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category Not Found!")
    return category

@categories.put("/{category_id}", tags=["Categories"], response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryUpdate):
    """
    Actualiza una categoría
    """
    category = await service.update_category(category_id, data)
    if not category:
        raise HTTPException(status_code=404, detail="Category Not Found!")
    return category

@categories.delete("/{category_id}", tags=["Categories"])
async def delete_category(category_id: str):
    """
    Elimina una categoría
    """
    deleted = await service.delete_category(category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Category Not Found!")
    return {"message": "Category deleted"}