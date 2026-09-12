"""Comprobaciones baratas que atrapan fallos caros.

    python tools/revisar.py

Cada una está aquí porque un fallo concreto llegó a la máquina de un
cliente. No sustituyen a las pruebas: atrapan lo que las pruebas no ven
porque no llegan a importar nada.
"""

import ast
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def arranque_al_final(archivo: Path) -> list:
    """El `if __name__ == "__main__"` tiene que ser lo último.

    Si queda a mitad del archivo, todo lo definido debajo no existe aún
    cuando main() se ejecuta, y el programa muere con un NameError al
    arrancar —no al importar, ni al compilar: solo al ejecutarlo—.

    Pasó de verdad: se añadieron funciones al final con `>>` y quedaron
    detrás del bloque de arranque. Compilaba, importaba, empaquetaba, y
    reventaba en el equipo del cliente con «name ... is not defined».
    """
    arbol = ast.parse(archivo.read_text(encoding="utf-8"))
    cuerpo = [n for n in arbol.body
              if not isinstance(n, (ast.Import, ast.ImportFrom))]

    for i, nodo in enumerate(cuerpo):
        es_arranque = (
            isinstance(nodo, ast.If)
            and isinstance(nodo.test, ast.Compare)
            and isinstance(nodo.test.left, ast.Name)
            and nodo.test.left.id == "__name__"
        )
        if es_arranque and i != len(cuerpo) - 1:
            sobra = cuerpo[i + 1]
            nombre = getattr(sobra, "name", type(sobra).__name__)
            return [f"{archivo.relative_to(RAIZ)}:{nodo.lineno}: el bloque de "
                    f"arranque no es lo último; «{nombre}» (línea "
                    f"{sobra.lineno}) queda detrás y no existirá al "
                    f"ejecutar main()"]
    return []


def main() -> int:
    problemas = []

    for archivo in (RAIZ / "launcher" / "race_core_studio.py",
                    RAIZ / "Backend" / "servidor.py",
                    RAIZ / "installer" / "setup.py",
                    RAIZ / "installer" / "instalar.py"):
        if archivo.is_file():
            problemas += arranque_al_final(archivo)

    if problemas:
        for p in problemas:
            print(f"  {p}")
        return 1

    print("Revisión pasada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
