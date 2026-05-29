from pydantic import BaseModel
from typing import Optional

class PilotRequest(BaseModel):
    pilotId: int

class Pilot(BaseModel):
    pilotId: int
    pilotName: str
    pilotStatus: bool
    pilotCountry: Optional[str] = None
    pilotTeamName: Optional[str] = None
    
    # Identidad y Media que agregamos al modelo
    pilotPhotoPath: Optional[str] = None
    pilotSocialHandle: Optional[str] = None
    pilotBiography: Optional[str] = None

    # Esta configuración permite que Pydantic lea directamente de SQLAlchemy
    class Config:
        from_attributes = True