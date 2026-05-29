from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# 1. El orden de salida (Grilla)
class GridEntry(BaseModel):
    startPosition: int        # El orden en que van a salir
    pilotId: int              # El piloto seleccionado
    vehicleId: int            # El auto que usará ese piloto

# 2. La carrera o sesión (Qualy o Heat)
class EventSession(BaseModel):
    sessionId: int
    sessionName: str          # Ej: "Qualy 1", "Heat 1"
    sessionType: str          # Ej: "Qualy", "Race", "Practice"
    categoryIds: List[int]    # Las categorías que corren en este heat
    grid: List[GridEntry]     # La lista de pilotos, autos y su orden de salida

# 3. El día del evento
class EventDay(BaseModel):
    dayId: int
    eventDate: date           # La fecha específica de este día
    sessions: List[EventSession] # Los heats o qualys de ese día

# 4. Petición básica
class EventRequest(BaseModel):
    eventId: int

# 5. El Evento Principal
class Event(BaseModel):
    eventId: int
    eventName: str            # Ej: "Gran Premio Panamá"
    eventStatus: bool         # Para el soft delete
    days: List[EventDay]      # Cuántos días son y qué ocurre en cada uno