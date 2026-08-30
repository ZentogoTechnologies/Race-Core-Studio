from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from contextlib import asynccontextmanager
from pymongo import AsyncMongoClient
from beanie import init_beanie
from config import settings
from docs import tags_metadata

# Models
from src.models.categories_model import Category
from src.models.pilots_model import Pilot
from src.models.vehicles_model import Vehicle
from src.models.users_model import User
from src.models.events_model import Event

# Routes
from src.routes.categories_routes import categories
from src.routes.pilots_routes import pilots
from src.routes.vehicles_routes import vehicles
from src.routes.graphics_routes import graphics
from src.routes.timing_routes import timing
from src.routes.users_routes import users
from src.routes.login_routes import login
from src.routes.system_routes import system
from src.routes.events_routes import events

# Auth
from src.services.auth_services import usuario_actual

# CasparCG
from src.services.casparcg_client import casparcg

@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncMongoClient(settings.MONGO_URI)
    await init_beanie(
        database=client[settings.DB_NAME],
        document_models=[Category, Pilot, Vehicle, User, Event]
    )
    print("✅ Conectado a MongoDB")
    yield
    await client.close()
    # La conexión con CasparCG se abre sola al primer comando; aquí solo
    # se cierra para no dejar el socket colgando al apagar el servidor.
    await casparcg.close()

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

# Fotos de pilotos y logos de marcas. CasparCG los carga por HTTP desde
# aquí, así que el backend debe estar corriendo para que se vean al aire.
app.mount(
    "/public",
    StaticFiles(directory=Path(__file__).parent / "src" / "public"),
    name="public",
)

# Todo lo que toca la base o manda al aire exige un JWT válido. La
# dependencia se declara aquí y no dentro de cada router para que la
# política de acceso se lea de un vistazo en un solo lugar.
PROTEGIDO = [Depends(usuario_actual)]

app.include_router(login, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users, prefix="/api/v1/users", tags=["Users"])

# Apagado del sistema. La guardia de rol va dentro del router.
app.include_router(system, prefix="/api/v1/system", tags=["System"])

app.include_router(categories, prefix="/api/v1/categories", tags=["Categories"], dependencies=PROTEGIDO)
app.include_router(pilots, prefix="/api/v1/pilots", tags=["Pilots"], dependencies=PROTEGIDO)
app.include_router(vehicles, prefix="/api/v1/vehicles", tags=["Vehicles"], dependencies=PROTEGIDO)
app.include_router(graphics, prefix="/api/v1/graphics", tags=["Graphics"], dependencies=PROTEGIDO)
app.include_router(events, prefix="/api/v1/events", tags=["Events"], dependencies=PROTEGIDO)

# Timing se protege por ruta, no en bloque: la única abierta es
# GET /timing/current, que es lo que consultan las plantillas de CasparCG
# desde file:// sin poder mandar cabeceras. La excepción se declara en
# timing_routes.py, al lado de las rutas. Lo mismo aplica a /public, que
# sirve las fotos con <img>, y un <img> tampoco manda Authorization.
app.include_router(timing, prefix="/api/v1/timing", tags=["Timing"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
