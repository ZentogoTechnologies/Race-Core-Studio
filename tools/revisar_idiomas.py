"""Que la ventana de servicios esté entera en los dos idiomas.

    python tools/revisar_idiomas.py

Un texto que falta no revienta nada: `t()` devuelve la clave y el
cliente ve «est_error» donde debería poner NOT RESPONDING, o un botón
sin etiqueta. Compila, empaqueta y se instala igual de bien; solo se ve
abriendo el programa, y en el idioma que no es el nuestro.

Se comprueban las tres formas de romperlo:

    · una clave en un idioma y no en el otro
    · una clave definida pero vacía
    · el panel pidiendo una clave que nadie definió
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "launcher"))


def claves_de_estados(archivo: Path) -> set:
    """Las claves del diccionario ESTADOS, leídas sin ejecutar nada."""
    import ast

    for nodo in ast.walk(ast.parse(archivo.read_text(encoding="utf-8"))):
        if (isinstance(nodo, ast.Assign)
                and any(getattr(d, "id", "") == "ESTADOS" for d in nodo.targets)
                and isinstance(nodo.value, ast.Dict)):
            return {v.elts[1].value for v in nodo.value.values
                    if isinstance(v, ast.Tuple) and len(v.elts) == 2
                    and isinstance(v.elts[1], ast.Constant)}
    return set()


def revisar() -> list:
    import textos

    problemas = []
    idiomas = sorted(textos.TEXTOS)

    base = set(textos.TEXTOS[idiomas[0]])
    for idioma in idiomas[1:]:
        for clave in sorted(base ^ set(textos.TEXTOS[idioma])):
            dónde = [i for i in idiomas if clave in textos.TEXTOS[i]]
            problemas.append(f"«{clave}» solo está en {', '.join(dónde)}")

    for idioma in idiomas:
        for clave, valor in sorted(textos.TEXTOS[idioma].items()):
            if not valor.strip():
                problemas.append(f"«{clave}» está vacía en «{idioma}»")

    # Lo que el lanzador pide de verdad, leído de su propio código.
    fuente = ""
    for archivo in ("panel.py", "race_core_studio.py"):
        fuente += (RAIZ / "launcher" / archivo).read_text(encoding="utf-8")

    pedidas = set(re.findall(r"""\bt\(\s*['"]([a-z_]+)['"]\s*\)""", fuente))
    pedidas |= set(re.findall(r"""\b_t\(\s*['"]([a-z_]+)['"]\s*\)""", fuente))

    # ESTADOS se lee del código y no importando panel: importarlo exige
    # tkinter, que no está en cualquier máquina, y esto es una revisión de
    # textos. Sin tkinter de por medio corre igual en Linux que en el
    # runner de Windows.
    pedidas |= claves_de_estados(RAIZ / "launcher" / "panel.py")

    for clave in sorted(pedidas - base):
        problemas.append(f"el lanzador pide «{clave}» y no está definida")

    return problemas


def main() -> int:
    import textos

    problemas = revisar()
    if problemas:
        for p in problemas:
            print(f"  {p}")
        return 1

    idiomas = sorted(textos.TEXTOS)
    print(f"Idiomas del lanzador: {', '.join(idiomas)} · "
          f"{len(textos.TEXTOS[idiomas[0]])} textos cada uno.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
