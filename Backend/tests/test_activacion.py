"""La activación contra el servidor, con un servidor de mentira.

Se levanta un HTTP de verdad en un puerto libre y se le hace contestar
lo que haga falta. Es la única forma de ejercitar los caminos que
importan —que el servidor diga no, que no conteste, que conteste basura—
sin tocar el servidor real ni gastar una activación de verdad.
"""

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import activacion                                                # noqa: E402


class Licencia:
    """Lo mínimo que activar() le pide a una licencia."""
    codigo = "RCS-2026-0001"

    def __init__(self, servidor):
        self.servidor = servidor


@pytest.fixture
def servidor():
    """Un HTTP que contesta lo que se le ponga en `guion`."""
    guion = {"codigo": 200, "cuerpo": json.dumps({"ok": True, "equipo": "abc"})}
    recibido = {}

    class Mano(BaseHTTPRequestHandler):
        def do_POST(self):
            largo = int(self.headers.get("Content-Length", 0))
            recibido["ruta"] = self.path
            recibido["cuerpo"] = json.loads(self.rfile.read(largo) or b"{}")
            recibido["tipo"] = self.headers.get("Content-Type")
            cuerpo = guion["cuerpo"].encode()
            self.send_response(guion["codigo"])
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)

        def log_message(self, *a):
            pass

    httpd = HTTPServer(("127.0.0.1", 0), Mano)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}", guion, recibido
    httpd.shutdown()


# ── Sin contrato todavía ─────────────────────────────────────

def test_sin_ruta_configurada_no_se_inventa_la_llamada(monkeypatch):
    """Es el estado de hoy: se dice, no se adivina una ruta."""
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "")
    r = activacion.activar("{}", Licencia("https://rcs.example.com"), "huella", "1.0.0")
    assert not r.ok and r.sin_configurar
    assert "fallo de empaquetado" in r.error
    assert not activacion.hay_con_que_activar()


def test_una_licencia_sin_servidor_no_se_activa(monkeypatch):
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    r = activacion.activar("{}", Licencia(""), "huella", "1.0.0")
    assert not r.ok and "contra qué servidor" in r.error


# ── El camino bueno ──────────────────────────────────────────

def test_activacion_correcta(monkeypatch, servidor):
    url, guion, recibido = servidor
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")

    r = activacion.activar('{"formato":"rcslic/1"}', Licencia(url), "HUELLA-1", "1.0.0")

    assert r.ok and r.datos["equipo"] == "abc"
    assert recibido["ruta"] == "/activar"
    assert recibido["tipo"] == "application/json"


def test_va_el_sobre_entero_y_no_los_campos_sueltos(monkeypatch, servidor):
    """El servidor tiene que poder comprobar la firma por su cuenta.

    Si se le mandaran el plan y el vencimiento por separado, un cliente
    podría decir «platinum» y el servidor no tendría con qué desmentirlo.
    """
    url, guion, recibido = servidor
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    sobre = '{"formato":"rcslic/1","firma":"xxx"}'

    activacion.activar(sobre, Licencia(url), "HUELLA-1", "1.0.0")

    assert recibido["cuerpo"]["licencia"] == sobre
    assert recibido["cuerpo"]["equipo"] == "HUELLA-1"
    assert recibido["cuerpo"]["codigo"] == "RCS-2026-0001"
    assert recibido["cuerpo"]["producto"] == "race-core-studio"
    assert "plan" not in recibido["cuerpo"]
    assert "vence" not in recibido["cuerpo"]


# ── Lo que el servidor puede contestar ───────────────────────

def test_el_servidor_dice_no_y_se_le_cree(monkeypatch, servidor):
    url, guion, _ = servidor
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    guion.update(codigo=403, cuerpo=json.dumps(
        {"ok": False, "mensaje": "Esta licencia ya se activó en otro equipo."}))

    r = activacion.activar("{}", Licencia(url), "h", "1.0.0")
    assert not r.ok
    assert r.error == "Esta licencia ya se activó en otro equipo."
    assert not r.sin_red


def test_ok_falso_con_200(monkeypatch, servidor):
    """Un 200 no es un sí: manda el campo ok."""
    url, guion, _ = servidor
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    guion.update(codigo=200, cuerpo=json.dumps({"ok": False, "error": "Licencia vencida."}))

    r = activacion.activar("{}", Licencia(url), "h", "1.0.0")
    assert not r.ok and r.error == "Licencia vencida."


def test_respuesta_que_no_es_json(monkeypatch, servidor):
    url, guion, _ = servidor
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    guion.update(codigo=200, cuerpo="<html>502 Bad Gateway</html>")

    r = activacion.activar("{}", Licencia(url), "h", "1.0.0")
    assert not r.ok and "no se entiende" in r.error


def test_error_sin_mensaje_legible(monkeypatch, servidor):
    url, guion, _ = servidor
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    guion.update(codigo=500, cuerpo="boom")

    r = activacion.activar("{}", Licencia(url), "h", "1.0.0")
    assert not r.ok and "código 500" in r.error


# ── Sin internet ─────────────────────────────────────────────

def test_sin_red_se_dice_que_hace_falta_internet(monkeypatch):
    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    monkeypatch.setattr(activacion, "INTENTOS", 1)
    monkeypatch.setattr(activacion, "ESPERA_SEGUNDOS", 1)

    # Puerto cerrado: el caso del autódromo sin conexión.
    r = activacion.activar("{}", Licencia("http://127.0.0.1:1"), "h", "1.0.0")

    assert not r.ok and r.sin_red
    assert "necesita conexión a internet" in r.error


def test_se_reintenta_una_vez(monkeypatch):
    """Una red que tarda en despertar no debe costar una instalación."""
    llamadas = []
    original = activacion.urllib.request.urlopen

    def falla(*a, **k):
        llamadas.append(1)
        raise OSError("red caída")

    monkeypatch.setattr(activacion, "RUTA_ACTIVAR", "activar")
    monkeypatch.setattr(activacion.urllib.request, "urlopen", falla)

    activacion.activar("{}", Licencia("http://127.0.0.1:1"), "h", "1.0.0")
    assert len(llamadas) == activacion.INTENTOS == 2
