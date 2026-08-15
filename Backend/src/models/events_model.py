from beanie import Document
from typing import Optional
from datetime import datetime

class Event(Document):
    name: str
    date: Optional[datetime] = None
    location: Optional[str] = None

    class Settings:
        name = "events"