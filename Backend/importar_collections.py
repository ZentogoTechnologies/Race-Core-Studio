"""Carga en Mongo las colecciones volcadas en src/database/collections.

Es la otra mitad de exportar_collections.py: aquel vuelca la base a un
JSON por colección y este lo vuelve a meter. Sirve para montar el sistema
en otra máquina, o para rellenar una base recién instalada.

    python importar_collections.py            # dice qué haría
    python importar_collections.py --aplicar  # lo hace

No pisa nada. Una colección que ya tiene documentos se salta y se avisa:
mezclar un respaldo viejo con datos vivos duplicaría o revertiría cambios
sin que se note. Para cargar encima hay que vaciarla antes a propósito.

Los _id y las referencias entre colecciones (los Link de Beanie, que van
como DBRef) se conservan tal cual. Por eso un vehículo sigue apuntando a
sus pilotos y a su categoría después de importar.
"""

import sys
from pathlib import Path

from bson.json_util import loads
from pymongo import MongoClient

from config import settings

ORIGEN = Path(__file__).resolve().parent / "src" / "database" / "collections"


def coleccion_de(archivo: Path) -> str:
    """'race_core_studio.vehicles.json' -> 'vehicles'.

    El prefijo es el nombre de la base de la que salió, que no tiene por
    qué coincidir con la de destino.
    """
    return archivo.stem.split(".")[-1]


def main(aplicar: bool):
    archivos = sorted(ORIGEN.glob("*.json"))
    if not archivos:
        print(f"No hay archivos en {ORIGEN}")
        return

    cliente = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
    base = cliente[settings.DB_NAME]

    # Contra qué servidor se carga. Con más de un Mongo en la máquina es
    # fácil acabar llenando el que no era.
    arranque = cliente["local"]["startup_log"].find_one(sort=[("startTime", -1)]) or {}
    version = arranque.get("buildinfo", {}).get("version", "?")
    ruta = arranque.get("cmdLine", {}).get("storage", {}).get("dbPath", "?")
    print(f"Destino: {settings.MONGO_URI} · base «{settings.DB_NAME}» · Mongo {version} · {ruta}\n")

    cargadas, saltadas = 0, []

    for archivo in archivos:
        nombre = coleccion_de(archivo)
        documentos = loads(archivo.read_text(encoding="utf-8"))
        existentes = base[nombre].count_documents({})

        if existentes:
            saltadas.append((nombre, existentes))
            print(f"  {nombre:<12} SALTADA: ya tiene {existentes} documentos")
            continue

        if not documentos:
            base.create_collection(nombre) if aplicar and nombre not in base.list_collection_names() else None
            print(f"  {nombre:<12} vacía en el respaldo, se deja creada")
            continue

        if aplicar:
            base[nombre].insert_many(documentos, ordered=False)
            cargadas += len(documentos)
        print(f"  {nombre:<12} {len(documentos):>4} documentos")

    if saltadas:
        print("\nSaltadas porque ya tenían datos. Vacíalas a propósito si quieres cargarlas.")

    if not aplicar:
        print("\nEn seco. Vuelve a llamarlo con --aplicar para escribir.")
        return

    print(f"\n{cargadas} documentos cargados.")
    print("Quedó así:")
    for nombre in sorted(base.list_collection_names()):
        print(f"  {nombre:<12} {base[nombre].count_documents({}):>4}")


if __name__ == "__main__":
    main("--aplicar" in sys.argv)
