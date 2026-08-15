import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from config import settings
from src.models.categories_model import Category, SubCategoryEmbedded

async def seed():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    await init_beanie(database=client[settings.DB_NAME], document_models=[Category])

    # Borrar categorías viejas para no duplicar
    await Category.find_all().delete()
    print("🗑️ Categorías anteriores borradas")

    categories_data = [
        # 1. TCR - sin sub
        {
            "category_id": 1,
            "category_name": "TCR",
            "discipline": "circuito",
            "description": "Turismo Carretera Racing",
            "sub_categories": []
        },
        # 2. GT Challenge - sin sub
        {
            "category_id": 2,
            "category_name": "GT Challenge",
            "discipline": "circuito",
            "description": "GT Challenge",
            "sub_categories": []
        },
        # 3. Street Legal - con A, B, C
        {
            "category_id": 3,
            "category_name": "Street Legal",
            "discipline": "circuito",
            "description": "Autos de calle",
            "sub_categories": [
                {"sub_category_id": 1, "sub_category_name": "Street Legal A"},
                {"sub_category_id": 2, "sub_category_name": "Street Legal B"},
                {"sub_category_id": 3, "sub_category_name": "Street Legal C"}
            ]
        },
        # 4. Super Turismo - con 1, 2, 3
        {
            "category_id": 4,
            "category_name": "Super Turismo",
            "discipline": "circuito",
            "description": "Super Turismo",
            "sub_categories": [
                {"sub_category_id": 1, "sub_category_name": "Super Turismo 1"},
                {"sub_category_id": 2, "sub_category_name": "Super Turismo 2"},
                {"sub_category_id": 3, "sub_category_name": "Super Turismo 3"}
            ]
        },
        # 5. Gran Turismo - con 1, 2, 3, 4
        {
            "category_id": 5,
            "category_name": "Gran Turismo",
            "discipline": "circuito",
            "description": "Gran Turismo",
            "sub_categories": [
                {"sub_category_id": 1, "sub_category_name": "Gran Turismo 1"},
                {"sub_category_id": 2, "sub_category_name": "Gran Turismo 2"},
                {"sub_category_id": 3, "sub_category_name": "Gran Turismo 3"},
                {"sub_category_id": 4, "sub_category_name": "Gran Turismo 4"}
            ]
        },
        # 6. Mono Marca - sin sub
        {
            "category_id": 6,
            "category_name": "Mono Marca",
            "discipline": "circuito",
            "description": "Mono Marca",
            "sub_categories": []
        }
    ]

    for cat_data in categories_data:
        sub_cats = [SubCategoryEmbedded(**sc) for sc in cat_data["sub_categories"]]
        category = Category(
            category_id=cat_data["category_id"],
            category_name=cat_data["category_name"],
            discipline=cat_data["discipline"],
            description=cat_data["description"],
            sub_categories=sub_cats
        )
        await category.insert()
        print(f"✅ Insertada: {category.category_name}")

    print("\n🎉 Seed de categorías completado!")
    client.close()

asyncio.run(seed())