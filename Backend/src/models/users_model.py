from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING
from typing import Optional
from datetime import datetime
import uuid


def nuevo_user_id() -> str:
    """UUID en texto. Se genera aquí y no en Mongo para que el id viaje
    igual en la respuesta del POST que en la del GET."""
    return str(uuid.uuid4())


def hoy() -> str:
    """Fecha en dd/mm/yyyy, el formato que se pidió para mostrar."""
    return datetime.now().strftime("%d/%m/%Y")


class User(Document):
    user_id: str = Field(default_factory=nuevo_user_id)
    username: str
    # Hash bcrypt, nunca la clave en claro. El nombre del campo se queda
    # como `password` porque es lo que ya esperaba el resto del código.
    password: str
    role: str = "standard"
    created_at: str = Field(default_factory=hoy)
    active: bool = True

    class Settings:
        name = "users"
        # Único de verdad en la base: dos `admin` romperían el login,
        # que resuelve al usuario por nombre.
        indexes = [
            IndexModel([("username", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)], unique=True),
        ]
