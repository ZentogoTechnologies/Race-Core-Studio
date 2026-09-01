from typing import Optional

from fastapi import HTTPException

from src.models.users_model import User
from src.schemas.common_schemas import Page
from src.schemas.users_schemas import UserCreate, UserUpdate, UserResponse
from src.services.auth_services import hashear, verificar
from src.services.pagination import campo_orden, combinar, direccion, filtro_busqueda


class UserService:
    def _to_response(self, user: User) -> UserResponse:
        return UserResponse(
            user_id=user.user_id,
            username=user.username,
            role=user.role,
            created_at=user.created_at,
            active=user.active,
        )

    # ── Lectura ──────────────────────────────────────────────

    ORDENABLES = {"username", "role", "created_at"}
    BUSCABLES = ["username"]

    async def get_users(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        active: Optional[bool] = None,
        sort_by: Optional[str] = None,
        sort_dir: Optional[str] = None,
        skip: int = 0,
        limit: Optional[int] = None,
    ) -> Page[UserResponse]:
        query = combinar(
            {"role": role} if role else None,
            # None es "todos"; True o False filtran. Se distingue de False
            # a propósito: `if active` dejaría fuera a los inactivos.
            {"active": active} if active is not None else None,
            filtro_busqueda(search, self.BUSCABLES),
        )

        total = await User.find(query).count()

        consulta = User.find(query).sort(
            (campo_orden(sort_by, self.ORDENABLES, "username"), direccion(sort_dir))
        ).skip(skip)

        if limit is not None:
            consulta = consulta.limit(limit)

        users = await consulta.to_list()

        return Page(
            items=[self._to_response(u) for u in users],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def get_user_by_id(self, user_id: str) -> UserResponse | None:
        user = await User.find_one({"user_id": user_id})
        return self._to_response(user) if user else None

    # ── Escritura ────────────────────────────────────────────

    async def create_user(self, data: UserCreate) -> UserResponse:
        # El índice único de username ya lo impediría, pero el error de
        # Mongo sale como 500; aquí se responde un 400 que se entiende.
        if await User.find_one({"username": data.username}):
            raise HTTPException(status_code=400, detail="Ese username ya existe")

        user = User(
            username=data.username,
            password=hashear(data.password),
            role=data.role,
        )
        await user.insert()
        return self._to_response(user)

    async def update_user(self, user_id: str, data: UserUpdate) -> UserResponse | None:
        user = await User.find_one({"user_id": user_id})
        if not user:
            return None

        cambios = data.model_dump(exclude_unset=True)

        # Bajar de rango o desactivar al dueño deja el módulo de usuarios
        # sin nadie que pueda entrar. La cuenta owner se maneja por seed.
        if user.role == "owner":
            if cambios.get("role") not in (None, "owner"):
                raise HTTPException(
                    status_code=400, detail="No se puede cambiar el rol del usuario dueño"
                )
            if cambios.get("active") is False:
                raise HTTPException(
                    status_code=400, detail="No se puede desactivar al usuario dueño"
                )

        nuevo_nombre = cambios.get("username")
        if nuevo_nombre and nuevo_nombre != user.username:
            if await User.find_one({"username": nuevo_nombre}):
                raise HTTPException(status_code=400, detail="Ese username ya existe")

        # La clave llega en claro y se guarda hasheada. Si no viene en el
        # cuerpo, `exclude_unset` la deja fuera y el hash actual sigue.
        if "password" in cambios:
            cambios["password"] = hashear(cambios["password"])

        for campo, valor in cambios.items():
            setattr(user, campo, valor)

        await user.save()
        return self._to_response(user)

    async def delete_user(self, user_id: str) -> bool:
        user = await User.find_one({"user_id": user_id})
        if not user:
            return False
        await user.delete()
        return True

    # ── Login ────────────────────────────────────────────────

    async def autenticar(self, username: str, password: str) -> User | None:
        """Devuelve el documento completo (no el response) porque quien
        llama necesita firmar el token con él."""
        user = await User.find_one({"username": username})

        # Mismo None para usuario inexistente, clave errada e inactivo: no
        # tiene sentido decirle a un extraño cuáles usuarios sí existen.
        if not user or not user.active:
            return None
        if not verificar(password, user.password):
            return None

        return user
