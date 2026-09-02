"""Vuelca todas las colecciones de Mongo a src/database/collections.

Un archivo por colección, con el mismo formato que ya había ahí: JSON de
mongoexport, con los ObjectId como {"$oid": ...}. Así se puede reimportar
con mongoimport sin convertir nada.

    python exportar_collections.py

Sirve de respaldo y de semilla: al montar el software en otra máquina se
importan estos archivos y la base queda con los mismos datos.
"""

import sys
from pathlib import Path

from bson.json_util import dumps
from pymongo import MongoClient

from config import settings

DESTINO = Path(__file__).resolve().parent / "src" / "database" / "collections"


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)

    try:
        cliente = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
        cliente.admin.command("ping")
    except Exception as e:
        print(f"No se pudo conectar a Mongo en {settings.MONGO_URI}: {e}")
        return 1

    base = cliente[settings.DB_NAME]

    # El prefijo del archivo lleva guiones bajos porque es lo que ya usaba
    # el volcado que había, y mongoimport no se fija en el nombre.
    prefijo = settings.DB_NAME.replace("-", "_")

    nombres = sorted(base.list_collection_names())
    if not nombres:
        print(f"La base «{settings.DB_NAME}» no tiene colecciones.")
        return 1

    print(f"  base: {settings.DB_NAME}")
    print(f"  destino: {DESTINO}")
    print()

    total = 0
    for nombre in nombres:
        documentos = list(base[nombre].find({}))

        archivo = DESTINO / f"{prefijo}.{nombre}.json"
        # indent=2 a propósito: estos archivos se revisan y se comparan en
        # git, y una sola línea de varios megas no se puede leer.
        archivo.write_text(dumps(documentos, indent=2, ensure_ascii=False),
                           encoding="utf-8")

        peso = archivo.stat().st_size
        print(f"  {nombre:<16} {len(documentos):>5} documentos   {peso/1024:>7.1f} KB")
        total += len(documentos)

    print()
    print(f"  {len(nombres)} colecciones, {total} documentos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
