"""La licencia .rcslic en cada arranque, y su renovación desde el panel.

Se firma con una clave generada aquí y metida en el llavero solo durante
la prueba, igual que lo hace rcs.zentogotech.com con la suya: el
contenido es una cadena JSON y la firma va sobre esos bytes exactos.
"""

import base64
import json
from datetime import date, datetime, timedelta, timezone

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

import activacion
import rcslic
from config import settings
from src.services import license_services as ls

HUELLA = "a" * 64
OTRA = "b" * 64


@pytest.fixture
def privada(monkeypatch):
    clave = Ed25519PrivateKey.generate()
    pem = clave.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    monkeypatch.setattr(rcslic, "LLAVERO", {"prueba": pem})
    return clave


@pytest.fixture(autouse=True)
def carpeta(tmp_path, monkeypatch):
    monkeypatch.setattr(ls, "ARCHIVO_RCSLIC", str(tmp_path / "licencia.rcslic"))
    monkeypatch.setattr(ls, "ARCHIVO_ACTIVACION", str(tmp_path / "activacion.json"))
    monkeypatch.setattr(settings, "LICENSE_STATE_FILE", str(tmp_path / "estado.json"))
    monkeypatch.setattr(settings, "LICENSE_FILE", str(tmp_path / "licencia.lic"))
    monkeypatch.setattr(ls, "huella_equipo", lambda: HUELLA)
    ls.limpiar_cache()
    yield tmp_path
    ls.limpiar_cache()


def emitir(privada, **cambios) -> bytes:
    datos = {
        "formato": 1, "codigo": "RCS-2026-0099", "cliente": "Autódromo de prueba",
        "cliente_tipo": "autodromo", "plan": "estandar_1", "plan_nombre": "Estándar 1 mes",
        "familia": "estandar", "plus": False,
        "emitida": (date.today() - timedelta(days=1)).isoformat(),
        "vence": (date.today() + timedelta(days=30)).isoformat(),
        "horas_demo": 0, "check_in_dias": 15, "equipo": None, "reemplaza_a": None,
        "servidor": "https://rcs.zentogotech.com",
    }
    datos.update(cambios)
    contenido = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    firma = base64.b64encode(privada.sign(contenido.encode("utf-8"))).decode()
    return json.dumps({"formato": "rcslic/1", "llave": "prueba",
                       "contenido": contenido, "firma": firma},
                      ensure_ascii=False, indent=4).encode("utf-8")


def instalar(carpeta, archivo: bytes, equipo=HUELLA, codigo="RCS-2026-0099", **extra):
    (carpeta / "licencia.rcslic").write_bytes(archivo)
    if equipo:
        (carpeta / "activacion.json").write_text(
            json.dumps({"ok": True, "codigo": codigo, "equipo": equipo,
                        "activada_en": datetime.now(timezone.utc).isoformat(), **extra}),
            encoding="utf-8")


def test_activa_opera(privada, carpeta):
    instalar(carpeta, emitir(privada))
    lic = ls.leer_licencia()
    assert lic.estado is ls.Estado.ACTIVA and lic.opera
    assert lic.licencia_id == "RCS-2026-0099"
    assert lic.plan == "Estándar 1 mes"
    assert lic.resumen()["codigo"] == "RCS-2026-0099"


def test_el_dia_que_vence_todavia_sirve(privada, carpeta):
    instalar(carpeta, emitir(privada, vence=date.today().isoformat()))
    assert ls.leer_licencia().estado is ls.Estado.ACTIVA


def test_se_lee_aunque_el_env_no_la_exija(privada, carpeta, monkeypatch):
    # Un .rcslic en la carpeta de datos manda siempre: no se puede
    # esquivar la licencia tocando LICENSE_REQUIRED en el .env.
    monkeypatch.setattr(settings, "LICENSE_REQUIRED", False)
    instalar(carpeta, emitir(privada, vence="2020-01-01", emitida="2019-01-01"))
    assert ls.leer_licencia().estado is ls.Estado.EXPIRADA


def test_sin_activar_no_opera(privada, carpeta):
    instalar(carpeta, emitir(privada), equipo=None)
    lic = ls.leer_licencia()
    assert lic.estado is ls.Estado.SIN_LICENCIA and not lic.opera
    assert "Ajustes" in lic.mensaje


def test_activada_para_otro_codigo_no_vale(privada, carpeta):
    instalar(carpeta, emitir(privada), codigo="RCS-2026-0001")
    assert ls.leer_licencia().estado is ls.Estado.SIN_LICENCIA


def test_copiada_a_otro_equipo(privada, carpeta):
    instalar(carpeta, emitir(privada), equipo=OTRA)
    lic = ls.leer_licencia()
    assert lic.estado is ls.Estado.OTRO_EQUIPO and not lic.opera


def test_atada_a_otro_equipo_desde_la_emision(privada, carpeta):
    instalar(carpeta, emitir(privada, equipo=OTRA))
    assert ls.leer_licencia().estado is ls.Estado.OTRO_EQUIPO


def test_vencida_dentro_de_la_gracia_opera_y_avisa(privada, carpeta):
    instalar(carpeta, emitir(privada, emitida="2026-01-01",
                             vence=(date.today() - timedelta(days=3)).isoformat()))
    lic = ls.leer_licencia()
    assert lic.estado is ls.Estado.GRACIA and lic.opera
    assert lic.gracia_dias == 7
    assert "día(s)" in lic.mensaje


def test_pasada_la_gracia_bloquea(privada, carpeta):
    instalar(carpeta, emitir(privada, emitida="2026-01-01",
                             vence=(date.today() - timedelta(days=8)).isoformat()))
    lic = ls.leer_licencia()
    assert lic.estado is ls.Estado.EXPIRADA and not lic.opera


def test_retocada_no_vale(privada, carpeta):
    archivo = json.loads(emitir(privada))
    archivo["contenido"] = archivo["contenido"].replace('"estandar_1"', '"platinum_12"')
    instalar(carpeta, json.dumps(archivo).encode())
    lic = ls.leer_licencia()
    assert lic.estado is ls.Estado.INVALIDA and not lic.opera


def test_firmada_con_otra_clave_no_vale(privada, carpeta):
    instalar(carpeta, emitir(Ed25519PrivateKey.generate()))
    assert ls.leer_licencia().estado is ls.Estado.INVALIDA


def test_demo_cuenta_desde_la_activacion(privada, carpeta):
    archivo = emitir(privada, vence=None, horas_demo=48)
    instalar(carpeta, archivo)
    assert ls.leer_licencia().estado is ls.Estado.ACTIVA

    hace = (datetime.now(timezone.utc) - timedelta(hours=50)).isoformat()
    instalar(carpeta, archivo, activada_en=hace)
    assert ls.leer_licencia().estado is ls.Estado.GRACIA


def test_reloj_atrasado(privada, carpeta):
    instalar(carpeta, emitir(privada))
    futuro = datetime.now(timezone.utc) + timedelta(days=60)
    (carpeta / "estado.json").write_text(json.dumps({"visto_max": futuro.isoformat()}))
    assert ls.leer_licencia().estado is ls.Estado.RELOJ_ALTERADO


# ── Renovación desde el panel ────────────────────────────────

def test_renovar_sustituye_y_activa(privada, carpeta, monkeypatch):
    instalar(carpeta, emitir(privada, emitida="2026-01-01",
                             vence=(date.today() - timedelta(days=3)).isoformat()))
    assert ls.leer_licencia().estado is ls.Estado.GRACIA

    enviado = {}

    def activar(sobre_crudo, lic, huella, version):
        enviado.update(codigo=lic.codigo, huella=huella)
        return activacion.Respuesta(ok=True, datos={"ok": True, "codigo": lic.codigo})

    monkeypatch.setattr(activacion, "activar", activar)
    nueva = emitir(privada, codigo="RCS-2026-0100",
                   vence=(date.today() + timedelta(days=365)).isoformat())

    lic = ls.instalar_rcslic(nueva)

    assert lic.estado is ls.Estado.ACTIVA
    assert lic.licencia_id == "RCS-2026-0100"
    assert enviado == {"codigo": "RCS-2026-0100", "huella": HUELLA}
    assert (carpeta / "licencia.rcslic").read_bytes() == nueva
    registro = json.loads((carpeta / "activacion.json").read_text(encoding="utf-8"))
    assert registro["equipo"] == HUELLA and registro["codigo"] == "RCS-2026-0100"
    assert not (carpeta / "licencia-nueva.rcslic").exists()


def test_si_el_servidor_dice_que_no_se_queda_la_anterior(privada, carpeta, monkeypatch):
    vieja = emitir(privada)
    instalar(carpeta, vieja)
    monkeypatch.setattr(activacion, "activar", lambda **_: activacion.Respuesta(
        ok=False, error="Esta licencia ya está activada en otro equipo."))

    with pytest.raises(ls.RenovacionFallida, match="otro equipo"):
        ls.instalar_rcslic(emitir(privada, codigo="RCS-2026-0100"))

    assert (carpeta / "licencia.rcslic").read_bytes() == vieja
    assert ls.leer_licencia().estado is ls.Estado.ACTIVA
    assert not (carpeta / "licencia-nueva.rcslic").exists()


def test_renovar_con_un_archivo_retocado_no_llama_al_servidor(privada, carpeta, monkeypatch):
    llamado = []
    monkeypatch.setattr(activacion, "activar", lambda **k: llamado.append(k))
    archivo = json.loads(emitir(privada))
    archivo["contenido"] = archivo["contenido"].replace("Estándar", "Platinum")

    with pytest.raises(ls.RenovacionFallida):
        ls.instalar_rcslic(json.dumps(archivo).encode())
    assert llamado == []


def test_renovar_con_basura(privada, carpeta):
    with pytest.raises(ls.RenovacionFallida):
        ls.instalar_rcslic(b"\xff\xfe no es una licencia")
