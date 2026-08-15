from src.models.categories_model import Category, SubCategoryEmbedded
from src.schemas.categories_schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from fastapi import HTTPException

class CategoryService:
    def _to_response(self, category: Category) -> CategoryResponse:
        # Convertir los SubCategoryEmbedded a dict para que Pydantic los valide bien
        sub_cats_data = [
            {"sub_category_id": sc.sub_category_id, "sub_category_name": sc.sub_category_name}
            for sc in category.sub_categories
        ]

        return CategoryResponse(
            _id=str(category.id), # usa _id y que Pydantic lo mapee a id con alias
            category_id=category.category_id,
            category_name=category.category_name,
            discipline=category.discipline,
            sub_categories=sub_cats_data, # <- ya son dicts
            description=category.description
        )

    async def create_category(self, data: CategoryCreate) -> CategoryResponse:
        exists = await Category.find_one(Category.category_id == data.category_id)
        if exists:
            raise HTTPException(status_code=400, detail="category_id ya existe")

        category = Category(
            category_id=data.category_id,
            category_name=data.category_name,
            discipline=data.discipline,
            sub_categories=[SubCategoryEmbedded(**sc.model_dump()) for sc in data.sub_categories],
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

    async def get_category_by_id(self, category_id: str) -> CategoryResponse:
        category = await Category.find_one(Category.category_id == int(category_id))
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")
        return self._to_response(category)

    async def update_category(self, category_id: str, data: CategoryUpdate) -> CategoryResponse:
        category = await Category.find_one(Category.category_id == int(category_id))
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        update_data = data.model_dump(exclude_unset=True)
        if "sub_categories" in update_data and update_data["sub_categories"]:
            update_data["sub_categories"] = [SubCategoryEmbedded(**sc.model_dump()) for sc in update_data["sub_categories"]]

        await category.update({"$set": update_data})
        await category.reload()
        return self._to_response(category)

    async def update_category(self, category_id: str, data: CategoryUpdate) -> CategoryResponse:
        category = await Category.find_one(Category.category_id == int(category_id))
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        update_data = data.model_dump(exclude_unset=True)
        if "sub_categories" in update_data and update_data["sub_categories"]:
            update_data["sub_categories"] = [SubCategoryEmbedded(**sc.model_dump()) for sc in update_data["sub_categories"]]

        await category.update({"$set": update_data})
        
        # Beanie viejo no tiene reload. Hacemos un find de nuevo
        updated_category = await Category.find_one(Category.category_id == int(category_id))
        return self._to_response(updated_category)    

    async def delete_category(self, category_id: str) -> dict:
        category = await Category.find_one(Category.category_id == int(category_id))
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")
        await category.delete()
        return {"detail": "Categoría eliminada"}