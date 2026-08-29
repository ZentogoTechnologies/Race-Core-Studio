from pydantic import BaseModel, Field
from typing import Optional, Literal

# Tres niveles, de mayor a menor:
#
#   owner    : dueño del sistema. Es el único que ve y toca el módulo de
#              usuarios. No se crea desde la interfaz, sale del seed.
#   admin    : todos los demás módulos con CRUD completo.
#   standard : entra a ver información y opera los gráficos, pero no
#              escribe en la base.
#
# El tipo es Literal para que un rol mal escrito reviente en la validación
# y no quede una cuenta con un rol que ninguna comprobación reconoce.
Role = Literal["owner", "admin", "standard"]

# Los que puede asignar el owner desde la interfaz. `owner` queda fuera a
# propósito: se reparte desde el seed, no desde un formulario.
RoleAsignable = Literal["admin", "standard"]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=4)
    role: RoleAsignable = "standard"


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=40)
    # Si viene, se vuelve a hashear. Si no viene, el hash actual no se toca.
    password: Optional[str] = Field(default=None, min_length=4)
    role: Optional[RoleAsignable] = None
    active: Optional[bool] = None


class UserResponse(BaseModel):
    # El hash nunca sale de aquí: no está declarado, así que aunque el
    # service devuelva el documento completo, FastAPI lo recorta.
    user_id: str
    username: str
    role: str
    created_at: str
    active: bool


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int          # segundos de vida del token
    user: UserResponse
