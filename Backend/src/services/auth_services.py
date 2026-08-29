"""Hash de contraseñas, emisión de JWT y la dependencia que protege rutas.

Vive aparte de users_services para romper el ciclo: las rutas de pilotos,
vehículos y gráficos necesitan la dependencia, pero no el CRUD de usuarios.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from src.models.users_model import User

# auto_error=False para poder devolver un 401 con mensaje propio en vez
# del 403 seco que manda HTTPBearer cuando falta la cabecera.
esquema = HTTPBearer(auto_error=False)


# ── Contraseñas ──────────────────────────────────────────────

def _en_bytes(password: str) -> bytes:
    """bcrypt corta en 72 bytes y a partir de la 5.0 lanza error en vez de
    truncar solo. Se trunca aquí para que una clave larga no reviente el
    login, y sobre bytes y no sobre caracteres porque una tilde ocupa dos."""
    return password.encode("utf-8")[:72]


def hashear(password: str) -> str:
    return bcrypt.hashpw(_en_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verificar(password: str, hash_guardado: str) -> bool:
    # Un hash corrupto o un documento viejo con la clave en claro haría
    # reventar checkpw; se responde "no coincide" y el login sigue vivo.
    try:
        return bcrypt.checkpw(_en_bytes(password), hash_guardado.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ── Tokens ───────────────────────────────────────────────────

def duracion_segundos() -> int:
    return settings.JWT_EXPIRE_HOURS * 3600


def crear_token(user: User) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": user.user_id,
        "username": user.username,
        "role": user.role,
        "iat": ahora,
        "exp": ahora + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def leer_token(token: str) -> dict:
    """Devuelve el payload o lanza 401. PyJWT ya valida la firma y el exp."""
    try:
        return jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión expiró, vuelve a iniciar sesión",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Dependencias ─────────────────────────────────────────────

async def usuario_actual(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(esquema),
) -> User:
    """Resuelve el usuario del token. Se relee de la base a propósito: si
    lo desactivan o le cambian el rol, el token que ya emitimos deja de
    servir sin esperar a que expire."""
    if credenciales is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el token de acceso",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = leer_token(credenciales.credentials)
    user = await User.find_one({"user_id": payload.get("sub")})

    if user is None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El usuario del token ya no existe o está inactivo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Quién puede escribir en la base. `standard` entra a mirar y a operar los
# gráficos, pero no crea, edita ni borra registros.
ESCRIBEN = {"owner", "admin"}


async def solo_owner(user: User = Depends(usuario_actual)) -> User:
    """El módulo de usuarios es exclusivo del dueño. Ni siquiera un admin
    lista las cuentas: si pudiera, dejaría de ser el único que las maneja."""
    if user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el usuario dueño puede administrar cuentas",
        )
    return user


async def puede_escribir(user: User = Depends(usuario_actual)) -> User:
    """Crear, editar y borrar registros.

    Va en el backend y no en la interfaz a propósito: esconder el botón
    solo esconde el botón, la ruta sigue abierta a cualquiera con un token
    y un curl.
    """
    if user.role not in ESCRIBEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu usuario es de solo lectura",
        )
    return user
