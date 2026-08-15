from beanie import Document
from typing import Optional

class User(Document):
    email: str
    password: str
    role: Optional[str] = "user"

    class Settings:
        name = "users"