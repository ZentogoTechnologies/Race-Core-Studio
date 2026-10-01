"""¿Qué bytes se firman en un .rcslic? Lo dice la clave pública.

    python tools/licencias/comprobar_rcslic.py licencia.rcslic clave.pem

Backend/rcslic.py da por hecho que la firma Ed25519 cubre los bytes UTF-8
del campo «contenido» tal cual. Es lo razonable —y lo que hace que el
archivo se pueda verificar sin volver a serializar nada—, pero es una
suposición hasta que se comprueba contra una licencia de verdad y su
clave.

Esta herramienta prueba esa convención y las que podrían haberse usado en
su lugar, y dice cuál cuadra. Si cuadra la primera, no hay nada que
cambiar. Si cuadra otra, ya se sabe exactamente qué ajustar y dónde, en
vez de ir a ciegas.

No necesita la clave privada, y no la quiere.
"""

import base64
import json
import sys
from pathlib import Path


def convenciones(sobre: dict) -> list[tuple[str, bytes]]:
    """Candidatas, de la más probable a la menos."""
    contenido = sobre["contenido"]
    sin_firma = {k: v for k, v in sobre.items() if k != "firma"}

    return [
        ("contenido tal cual, UTF-8",
         contenido.encode("utf-8")),

        ("contenido sin espacios alrededor",
         contenido.strip().encode("utf-8")),

        ("prefijo de dominio + contenido",
         b"rcslic/1:" + contenido.encode("utf-8")),

        ("sobre sin firma, JSON canónico (claves ordenadas, sin espacios)",
         json.dumps(sin_firma, sort_keys=True, separators=(",", ":"),
                    ensure_ascii=False).encode("utf-8")),

        ("sobre sin firma, JSON canónico con ensure_ascii",
         json.dumps(sin_firma, sort_keys=True, separators=(",", ":"),
                    ensure_ascii=True).encode("utf-8")),

        ("contenido reserializado canónico",
         json.dumps(json.loads(contenido), sort_keys=True, separators=(",", ":"),
                    ensure_ascii=False).encode("utf-8")),

        ("llave + contenido",
         (sobre["llave"] + contenido).encode("utf-8")),
    ]


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip())
        return 2

    archivo, clave = Path(sys.argv[1]), Path(sys.argv[2])

    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.serialization import load_pem_public_key

    sobre = json.loads(archivo.read_text(encoding="utf-8"))
    publica = load_pem_public_key(clave.read_text(encoding="utf-8").encode())
    firma = base64.b64decode(sobre["firma"])

    print(f"Archivo : {archivo.name}")
    print(f"Llave   : {sobre.get('llave')}")
    print(f"Firma   : {len(firma)} bytes")
    print()

    acertada = None
    for nombre, mensaje in convenciones(sobre):
        try:
            publica.verify(firma, mensaje)
        except InvalidSignature:
            print(f"  no   · {nombre}")
        else:
            print(f"  SÍ   · {nombre}")
            if acertada is None:
                acertada = nombre

    print()
    if acertada is None:
        print("Ninguna cuadra. O la clave pública no es la que firmó este")
        print("archivo, o se firma algo distinto a todo lo probado. En ese")
        print("caso hace falta que quien emite diga exactamente qué bytes")
        print("pasa a Ed25519.")
        return 1

    if acertada == "contenido tal cual, UTF-8":
        print("Es lo que Backend/rcslic.py ya hace. No hay nada que cambiar.")
        return 0

    print(f"Backend/rcslic.py firma «contenido tal cual» y aquí cuadra:")
    print(f"  {acertada}")
    print("Hay que ajustar _comprobar_firma() a esa convención.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
