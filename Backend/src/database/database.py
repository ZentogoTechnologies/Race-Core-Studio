import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from src.models.categories_model import Category # <- Aquí ya viene SubCategoryEmbedded dentro
from src.models.events_model import Event
from src.models.pilots_model import Pilot
from src.models.users_model import User
from src.models.vehicles_model import Vehicle

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "race_core_studio")

async def init_db():
    client = AsyncIOMotorClient(MONGO_URI)
    database = client[DB_NAME]

    await init_beanie(
        database=database,
        document_models=[Category, Event, Pilot, User, Vehicle] # <- BORRA SubCategory de aquí
    )
    print(f"✅ Conectado a MongoDB: {DB_NAME}")

async def close_db():
    print(f"❌ Desconectado de MongoDB")