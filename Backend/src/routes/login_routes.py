from fastapi import APIRouter, Depends, HTTPException, status

from src.models.users_model import User
from src.schemas.users_schemas import LoginRequest, TokenResponse, UserResponse
from src.services.auth_services import crear_token, duracion_segundos, usuario_actual
from src.services.users_services import UserService

login = APIRouter()
service = UserService()


@login.post("/login", tags=["Auth"], response_model=TokenResponse)
async def iniciar_sesion(data: LoginRequest):
    """
    Valida usuario y contraseña y devuelve el JWT que exige el resto del API
    """
    user = await service.autenticar(data.username, data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=crear_token(user),
        expires_in=duracion_segundos(),
        user=service._to_response(user),
    )


@login.get("/me", tags=["Auth"], response_model=UserResponse)
async def sesion_actual(user: User = Depends(usuario_actual)):
    """
    Devuelve el usuario del token. El frontend la usa al cargar para saber
    si el token que tiene guardado sigue sirviendo
    """
    return service._to_response(user)
