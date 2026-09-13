"""Que la salida del backend no pueda tumbar su propio arranque.

En Windows, con la salida redirigida a un archivo —que es como la arranca
el lanzador— Python no escribe en UTF-8 sino en la página de códigos del
sistema, cp1252 en español. El primer carácter que no quepa ahí lanza un
UnicodeEncodeError, y si ocurre durante el arranque de la aplicación se
lleva el proceso entero:

    UnicodeEncodeError: 'charmap' codec can't encode character '\\u2705'
    ERROR:    Application startup failed. Exiting.

Pasó de verdad: el «✅ Conectado a MongoDB» del arranque. El backend
conectaba con la base y moría al anunciarlo.
"""

import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent


def test_servidor_fija_su_salida_a_utf8():
    """El arreglo tiene que estar en el punto de entrada, no en los prints."""
    fuente = (BACKEND / "servidor.py").read_text(encoding="utf-8")
    assert "reconfigure(encoding=\"utf-8\"" in fuente, (
        "servidor.py ya no fija su salida a UTF-8; un emoji en cualquier "
        "print del arranque volveria a tumbar el backend en Windows"
    )


@pytest.mark.parametrize("caracter", ["✅", "⚠", "❌", "←", "→", "─"])
def test_esos_caracteres_no_caben_en_cp1252(caracter):
    """Deja constancia de por que hace falta el arreglo."""
    with pytest.raises(UnicodeEncodeError):
        caracter.encode("cp1252")


def test_reconfigurar_salva_el_print():
    """Con la salida forzada a cp1252, el arreglo evita el fallo."""
    programa = (
        "import sys\n"
        "for f in (sys.stdout, sys.stderr):\n"
        "    try: f.reconfigure(encoding='utf-8', errors='replace')\n"
        "    except Exception: pass\n"
        "print('\\u2705 Conectado a MongoDB')\n"
    )
    r = subprocess.run([sys.executable, "-c", programa],
                       capture_output=True,
                       env={"PYTHONIOENCODING": "cp1252", "PATH": ""})
    assert r.returncode == 0, r.stderr.decode("utf-8", "replace")
