from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from config import settings
from docs import tags_metadata

# Models
from src.models.categories_model import Category
from src.models.pilots_model import Pilot
from src.models.vehicles_model import Vehicle

# Routes
from src.routes.categories_routes import categories
from src.routes.pilots_routes import pilots
from src.routes.vehicles_routes import vehicles

@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncIOMotorClient(settings.MONGO_URI)
    await init_beanie(
        database=client[settings.DB_NAME],
        document_models=[Category, Pilot, Vehicle]
    )
    print("✅ Conectado a MongoDB")
    yield
    client.close()

app = FastAPI(
    title="Race Core Studio",
    description="Software de Gestión de Pilotos, Categorías, Vehículos, Eventos y Gráficos",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories, prefix="/api/v1/categories", tags=["Categories"])
app.include_router(pilots, prefix="/api/v1/pilots", tags=["Pilots"])
app.include_router(vehicles, prefix="/api/v1/vehicles", tags=["Vehicles"])