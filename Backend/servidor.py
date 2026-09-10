"""Punto de entrada del backend congelado.

Suelto, el backend se arranca con uvicorn desde la línea de órdenes:

    python -m uvicorn main:app --host 0.0.0.0 --port 8080

Congelado no hay línea de órdenes ni uvicorn que invocar: hay un .exe que
se ejecuta. Este archivo es lo que ese .exe corre, y hace lo mismo que
haría esa orden, pero desde dentro.
"""

import multiprocessing
import os
import sys
from pathlib import Path

# Congelado, el .exe se ejecuta desde donde sea que esté el acceso
# directo. Sin esto, «import main» y «import src.…» no encuentran nada.
sys.path.insert(0, str(Path(__file__).resolve().parent))


def configurar_desde_argumentos() -> int | None:
    """--configurar deja el sistema listo en vez de arrancar el servidor.

    Lo llama el instalador justo después de copiar los archivos, con el
    correo y la clave que escribió el cliente en su página del asistente.
    """
    if "--configurar" not in sys.argv:
        return None

    import argparse

    p = argparse.ArgumentParser(prog="race-core-backend", add_help=False)
    p.add_argument("--configurar", action="store_true")
    p.add_argument("--correo", required=True)
    p.add_argument("--clave", required=True)
    p.add_argument("--dias", type=int)
    args, _ = p.parse_known_args()

    from configurar import configurar

    return configurar(args.correo, args.clave, args.dias)


def main() -> int:
    codigo = configurar_desde_argumentos()
    if codigo is not None:
        return codigo

    # Sin esto, cada proceso hijo que arranque el ejecutable congelado
    # vuelve a ejecutar el programa entero desde el principio, y en
    # Windows eso son instaladores abriéndose en bucle.
    multiprocessing.freeze_support()

    import uvicorn

    import rutas
    from config import settings

    print(f"  Race Core Studio · backend {settings.APP_VERSION}")
    print(f"  datos en {rutas.DATOS}")

    # El objeto, no la cadena "main:app". Uvicorn resolvería esa cadena
    # importando el módulo por su nombre, y dentro de un .exe no hay un
    # main.py que importar: falla con «Could not import module "main"».
    # Importarlo aquí funciona porque el módulo sí viaja dentro.
    from main import app

    # Una sola instancia y sin recarga: recargar necesita reimportar por
    # nombre de archivo, y aquí tampoco hay archivo.
    uvicorn.run(
        app,
        host=os.environ.get("RCS_HOST", "0.0.0.0"),
        port=int(os.environ.get("RCS_PUERTO", "8080")),
        workers=1,
        reload=False,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
