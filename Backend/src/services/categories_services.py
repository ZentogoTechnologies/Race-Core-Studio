from src.models.categories_model import Category, SubCategoryEmbedded
from src.schemas.categories_schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from fastapi import HTTPException

class CategoryService:
    def _to_response(self, category: Category) -> CategoryResponse:
        return CategoryResponse(
            id=str(category.id), # id de mongo
            category_id=category.category_id,
            category_name=category.category_name,
            discipline=category.discipline,
            sub_categories=category.sub_categories,
            description=category.description
        )

    async def create_category(self, data: CategoryCreate) -> CategoryResponse:
        # Validar que no exista el category_id
        exists = await Category.find_one(Category.category_id == data.category_id)
        if exists:
            raise HTTPException(status_code=400, detail="category_id ya existe")

        category = Category(
            category_id=data.category_id,
            category_name=data.category_name,
            discipline=data.discipline,
            sub_categories=[SubCategoryEmbedded(**sc.model_dump()) for sc in data.sub_categories], # model_dump en pydantic v2
            description=data.description
        )
        await category.insert()
        return self._to_response(category)

    async def get_categories(self, discipline: str = None) -> list[CategoryResponse]:
        query = {}
        if discipline:
            query["discipline"] = discipline
        categories = await Category.find(query).to_list()
        return [self._to_response(c) for c in categories]

    async def get_category_by_id(self, category_id: str) -> CategoryResponse: # <- str para que cuadre con route
        # Convertimos a int porque tu category_id es int
        category = await Category.find_one(Category.category_id == int(category_id))
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")
        return self._to_response(category)

    async def update_category(self, category_id: str, data: CategoryUpdate) -> CategoryResponse: # <- str
        category = await Category.find_one(Category.category_id == int(category_id)) # <- int
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        update_data = data.model_dump(exclude_unset=True) # model_dump en pydantic v2
        if "sub_categories" in update_data and update_data["sub_categories"]:
            update_data["sub_categories"] = [SubCategoryEmbedded(**sc.model_dump()) for sc in update_data["sub_categories"]]

        await category.update({"$set": update_data})
        await category.reload()
        return self._to_response(category)

    async def delete_category(self, category_id: str) -> dict: # <- str
        category = await Category.find_one(Category.category_id == int(category_id)) # <- int
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        # Opcional: validar que no haya vehicles usando esta category
        await category.delete()
        return {"detail": "Categoría eliminada"}