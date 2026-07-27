from pydantic import BaseModel
from typing import Optional

class UserRequest(BaseModel):
    pilotId: int

class User(BaseModel):
    userId: int
    userName: str
    userPassword: str
    userStatus: bool
    