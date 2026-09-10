"""
Deja la marca de cada vehículo tal como la escribe el catálogo.

Antes el campo era texto libre y en la base convivían "Bmw" y "BMW" como
si fueran dos marcas. Peor: el logo se busca por el nombre, así que un
"Mc Laren" tecleado no encontraba su archivo y salía al aire sin logo sin
que nadie se enterara.

Ahora la marca se elige de una lista cerrada, y esto pone al día lo que ya
estaba guardado. Es idempotente: lo que ya coincide con el catálogo se
queda como está.

    python migrar_marcas.py            # dice qué haría
    python migrar_marcas.py --aplicar  # lo hace

Lo que no corresponde a ninguna marca —"00", "rush"— se vacía, porque un
valor que el formulario ya no admite tampoco se puede corregir desde el
panel sin borrarlo antes. Esos vehículos se listan al final para que
alguien les ponga la marca buena.
"""

import asyncio
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from config import settings

sys.path.insert(0, str(Path(__file__).parent))
from src.services.marcas_services import normalizar


async def main(aplicar: bool):
    cliente = AsyncIOMotorClient(settings.MONGO_URI)
    vehiculos = cliente[settings.DB_NAME]["vehicles"]

    cambios, vaciar, iguales = [], [], 0

    campos = {"vehicle_id": 1, "number": 1, "brand": 1, "model": 1}

    async for v in vehiculos.find({}, campos):
        valor = (v.get("brand") or "").strip()
        if not valor:
            continue

        etiqueta = f"#{v.get('number') or '--'} {valor} {v.get('model') or ''}".strip()
        bueno = normalizar(valor)

        if bueno is None:
            vaciar.append((v["_id"], v.get("vehicle_id"), etiqueta))
        elif bueno == valor:
            iguales += 1
        else:
            cambios.append((v["_id"], valor, bueno))

    print(f"{len(cambios)} por normalizar, {iguales} ya correctas, "
          f"{len(vaciar)} sin marca en el catálogo")

    if cambios:
        print("\nSe normalizan:")
        for _, viejo, nuevo in sorted(cambios, key=lambda c: c[1].lower()):
            print(f"  {viejo!r} -> {nuevo}")

    if vaciar:
        print("\nNo son marcas, se vacían. Corrígelos desde el panel:")
        for _, vid, etiqueta in vaciar:
            print(f"  vehiculo {vid}: {etiqueta}")

    if not aplicar:
        print("\nEn seco. Vuelve a llamarlo con --aplicar para escribir.")
        return

    for _id, _, bueno in cambios:
        await vehiculos.update_one({"_id": _id}, {"$set": {"brand": bueno}})

    for _id, _, _ in vaciar:
        await vehiculos.update_one({"_id": _id}, {"$set": {"brand": None}})

    print(f"\n{len(cambios)} normalizadas, {len(vaciar)} vaciadas.")


if __name__ == "__main__":
    asyncio.run(main("--aplicar" in sys.argv))
