import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

# Obtener las credenciales
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Construir la URL de conexión de MySQL usando PyMySQL
# Formato: mysql+pymysql://usuario:password@host:puerto/nombre_base_datos
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Crear el motor de conexión (engine)
# Crear el motor de conexión (engine) con defensas contra desconexiones remotas
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # Hace un pequeño "ping" para verificar si la conexión sigue viva antes de usarla
    pool_recycle=1800    # Recicla y renueva la conexión cada 30 minutos (1800 segundos) preventivamente
)

# Crear la clase SessionLocal que cada endpoint usará para consultar la base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Crear la clase Base de la cual heredarán todos tus modelos (como Pilot, Vehicle, etc.)
Base = declarative_base()

# Dependencia para que FastAPI abra y cierre la conexión en cada petición
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()