from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from src.models.users_model import User
from src.schemas.common_schemas import Page
from src.schemas.users_schemas import UserCreate, UserUpdate, UserResponse
from src.services.auth_services import solo_owner, usuario_actual
from src.services.users_services import UserService

# Módulo entero reservado al dueño, incluida la lectura. Un admin no debe
# ni siquiera poder enumerar las cuentas que existen: si pudiera, dejaría
# de ser cierto que el owner es el único que las administra.
users = APIRouter(dependencies=[Depends(solo_owner)])
service = UserService()


@users.get("/", tags=["Users"], response_model=Page[UserResponse])
async def get_users(
    search: Optional[str] = Query(None, description="Búsqueda parcial por nombre de usuario"),
    role: Optional[str] = Query(None, description="Filtrar por rol"),
    sort_by: Optional[str] = Query(None, description="Campo por el que ordenar"),
    sort_dir: Optional[str] = Query("asc", description="asc o desc"),
    skip: int = Query(0, ge=0, description="Cuántos registros saltar"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Tamaño de página"),
):
    """
    Lista los usuarios paginados. Ordena por: username, role, created_at
    """
    return await service.get_users(
        search=search, role=role, sort_by=sort_by,
        sort_dir=sort_dir, skip=skip, limit=limit,
    )


@users.post("/", tags=["Users"], response_model=UserResponse, status_code=201)
async def create_user(data: UserCreate):
    """
    Crea un usuario con rol admin o standard
    """
    return await service.create_user(data)


@users.get("/{user_id}", tags=["Users"], response_model=UserResponse)
async def get_user_by_id(user_id: str):
    """
    Obtiene un usuario por su user_id
    """
    user = await service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User Not Found!")
    return user


@users.put("/{user_id}", tags=["Users"], response_model=UserResponse)
async def update_user(user_id: str, data: UserUpdate, actual: User = Depends(usuario_actual)):
    """
    Actualiza un usuario. El dueño no puede cambiarse el rol a sí mismo
    """
    # Si el owner se rebaja a admin pierde el acceso a este módulo y ya no
    # hay quien administre cuentas: el sistema se queda sin dueño.
    if actual.user_id == user_id and data.role is not None:
        raise HTTPException(
            status_code=400,
            detail="No puedes cambiar tu propio rol",
        )

    user = await service.update_user(user_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="User Not Found!")
    return user


@users.delete("/{user_id}", tags=["Users"])
async def delete_user(user_id: str, actual: User = Depends(usuario_actual)):
    """
    Elimina un usuario. No se puede eliminar al dueño
    """
    if actual.user_id == user_id:
        raise HTTPException(
            status_code=400, detail="No puedes eliminar tu propio usuario"
        )

    # El owner sale del seed, no de la interfaz: si se borra desde aquí no
    # queda forma de volver a entrar al módulo para recrearlo.
    objetivo = await User.find_one({"user_id": user_id})
    if objetivo and objetivo.role == "owner":
        raise HTTPException(
            status_code=400, detail="No se puede eliminar a un usuario dueño"
        )

    deleted = await service.delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User Not Found!")
    return {"message": "User deleted"}
