from sqlalchemy import Column, Integer, String, Boolean, Text
# Asegúrate de que esta importación apunte correctamente a donde guardaste database.py
# Si database.py está dentro de la carpeta 'database' en 'src', sería así:
from src.database.database import Base 

class PilotModel(Base):
    __tablename__ = "pilots"

    pilotId = Column(Integer, primary_key=True, index=True, autoincrement=True)
    pilotName = Column(String(100), nullable=False)
    pilotStatus = Column(Boolean, default=True)
    
    # Datos opcionales (nullable=True)
    pilotCountry = Column(String(50), nullable=True)
    pilotTeamName = Column(String(100), nullable=True)
    
    # Identidad y Media sugeridos anteriormente
    pilotPhotoPath = Column(String(255), nullable=True)
    pilotSocialHandle = Column(String(100), nullable=True)
    pilotBiography = Column(Text, nullable=True)