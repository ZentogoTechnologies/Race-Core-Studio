"""Reparte la versión desde VERSION a todo lo que no puede leerla sola.

    python tools/version.py            comprueba que todo coincide
    python tools/version.py --escribir  la propaga

El backend, el instalador y el lanzador leen VERSION directamente. Estos
dos no pueden: package.json tiene que llevar un literal, y los recursos
de versión de Windows los lee PyInstaller antes de que corra nada. Así
que se generan desde VERSION, y CI comprueba que nadie los tocó a mano.
"""

import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
VERSION = (RAIZ / "VERSION").read_text(encoding="utf-8").strip()

# Windows quiere cuatro números; VERSION tiene tres.
CUATRO = tuple(int(n) for n in VERSION.split(".")[:3]) + (0,)

RECURSOS = ("installer/version-info.txt", "launcher/version-info.txt")


def revisar(escribir: bool) -> list:
    problemas = []

    paquete = RAIZ / "Frontend" / "package.json"
    datos = json.loads(paquete.read_text(encoding="utf-8"))
    if datos.get("version") != VERSION:
        problemas.append(f"{paquete.name}: {datos.get('version')} ≠ {VERSION}")
        if escribir:
            datos["version"] = VERSION
            paquete.write_text(json.dumps(datos, indent=2, ensure_ascii=False) + "\n",
                               encoding="utf-8")

    for ruta in RECURSOS:
        archivo = RAIZ / ruta
        texto = archivo.read_text(encoding="utf-8")
        nuevo = re.sub(r"\(\d+, \d+, \d+, \d+\)", str(CUATRO).replace("'", ""), texto)
        nuevo = re.sub(r"'(File|Product)Version', '[\d.]+'",
                       lambda m: f"'{m.group(1)}Version', '{'.'.join(map(str, CUATRO))}'", nuevo)
        if nuevo != texto:
            problemas.append(f"{ruta}: no coincide con {VERSION}")
            if escribir:
                archivo.write_text(nuevo, encoding="utf-8")

    return problemas


def main() -> int:
    p = argparse.ArgumentParser(description="Reparte la versión desde VERSION.")
    p.add_argument("--escribir", action="store_true")
    args = p.parse_args()

    problemas = revisar(args.escribir)

    if not problemas:
        print(f"Todo en la versión {VERSION}.")
        return 0

    for problema in problemas:
        print(("  corregido: " if args.escribir else "  desajuste: ") + problema)

    if args.escribir:
        print(f"\nTodo puesto en {VERSION}.")
        return 0

    print(f"\nEjecuta:  python tools/version.py --escribir")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
