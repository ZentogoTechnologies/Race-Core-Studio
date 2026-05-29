from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from docs import tags_metadata

# --- NUEVAS IMPORTACIONES PARA LA BASE DE DATOS ---
from src.database.database import engine, Base
from src.models import pilot_model  # Es vital importar el modelo para que SQLAlchemy lo vea

from src.routes.login import login
from src.routes.pilots import pilots
from src.routes.vehicles import vehicles
from src.routes.circuit import circuit
from src.routes.drag import drag
from src.routes.events import events
from src.routes.users import users

# --- LÍNEA MÁGICA PARA MATERIALIZAR LAS TABLAS EN HOSTGATOR ---
# Esta instrucción viaja a la nube y crea la tabla si no existe
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Zentogo Racing Graphics",
    description="Rest API Racing Graphics - ZENTOGO",
    version="1.0.0",
    openapi_tags=tags_metadata
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especifica los dominios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rutas
app.include_router(login, tags=["Login"])
app.include_router(pilots, tags=["Pilots"])
app.include_router(vehicles, tags=["Vehicles"])
app.include_router(circuit, tags=["Categories"])
app.include_router(drag, tags=["Categories"])
app.include_router(events, tags=["Events"])
app.include_router(users, tags=["Users"])