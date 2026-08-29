"""Crea el usuario dueño del sistema.

    python seed_admin.py

Es idempotente: si la cuenta ya existe no la duplica ni le pisa la clave.

    python seed_admin.py --reset       vuelve a poner la contraseña inicial
    python seed_admin.py --migrar      lleva los roles viejos a los nuevos

El rol `owner` solo se reparte desde aquí. Desde la interfaz el dueño crea
cuentas `admin` y `standard`, pero no puede crear otro dueño ni quitarse el
rol a sí mismo: si pudiera, el sistema quedaría sin nadie que administre
las cuentas.
"""

import asyncio
import sys

from beanie import init_beanie
from pymongo import AsyncMongoClient

from config import settings
from src.models.users_model import User
from src.services.auth_services import hashear

USERNAME = "zentogotech"
PASSWORD = "zentogotech"
ROLE = "owner"

# Cuentas de versiones anteriores que ya no deben existir. admin/admin era
# una credencial adivinable y esto sale al aire.
A_ELIMINAR = ["admin"]

# Roles de antes de que existieran owner/admin/standard.
EQUIVALENCIAS = {"viewer": "standard", "operator": "standard", "user": "standard"}


async def main(reset: bool = False, migrar: bool = False):
    client = AsyncMongoClient(settings.MONGO_URI)
    await init_beanie(database=client[settings.DB_NAME], document_models=[User])

    if migrar:
        for viejo, nuevo in EQUIVALENCIAS.items():
            afectados = await User.find({"role": viejo}).to_list()
            for u in afectados:
                u.role = nuevo
                await u.save()
            if afectados:
                print(f"  {len(afectados)} usuario(s) '{viejo}' -> '{nuevo}'")

    for nombre in A_ELIMINAR:
        if nombre == USERNAME:
            continue
        viejo = await User.find_one({"username": nombre})
        if viejo:
            await viejo.delete()
            print(f"  Eliminado el usuario heredado '{nombre}'.")

    existente = await User.find_one({"username": USERNAME})

    if existente and not reset:
        print(f"El usuario '{USERNAME}' ya existe.")
        print(f"  user_id    : {existente.user_id}")
        print(f"  role       : {existente.role}")
        print(f"  created_at : {existente.created_at}")
        print("\nUsa --reset si quieres devolverle la contraseña inicial.")
        await client.close()
        return

    if existente:
        existente.password = hashear(PASSWORD)
        existente.role = ROLE
        existente.active = True
        await existente.save()
        print(f"Contraseña de '{USERNAME}' restablecida a '{PASSWORD}'.")
        await client.close()
        return

    user = User(username=USERNAME, password=hashear(PASSWORD), role=ROLE)
    await user.insert()

    print("Usuario dueño creado:")
    print(f"  user_id    : {user.user_id}")
    print(f"  username   : {user.username}")
    print(f"  password   : {PASSWORD}  (guardada con hash bcrypt)")
    print(f"  role       : {user.role}")
    print(f"  created_at : {user.created_at}")

    await client.close()


if __name__ == "__main__":
    asyncio.run(main(
        reset="--reset" in sys.argv,
        migrar="--migrar" in sys.argv,
    ))
