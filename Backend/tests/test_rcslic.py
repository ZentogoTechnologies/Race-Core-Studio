"""El lector de .rcslic, atacado a propósito.

La firma es lo único que separa una licencia de Zentogo de una que
cualquiera se escriba en el Notepad, así que cada forma de romperla
tiene su prueba: el contenido cambiado, la firma cambiada, otra clave,
el sobre a medias, la extensión que no es.

El par de claves se genera aquí mismo. Las de verdad no entran en el
repositorio ni para probar.
"""

import base64
import json
import sys
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, NoEncryption, PrivateFormat, PublicFormat,
)

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import rcslic                                                    # noqa: E402

LLAVE = "pruebas-2026"

CONTENIDO = {
    "formato": 1,
    "codigo": "RCS-2026-0001",
    "cliente": "Autódromo de Pruebas",
    "cliente_tipo": "autodromo",
    "plan": "demo",
    "plan_nombre": "Demo",
    "familia": "demo",
    "plus": False,
    "emitida": "2026-09-30",
    "vence": None,
    "horas_demo": 48,
    "check_in_dias": 15,
    "equipo": None,
    "reemplaza_a": None,
    "servidor": "https://rcs.example.com",
}


@pytest.fixture
def firmante(monkeypatch):
    """Un par de claves nuevo, puesto en el llavero del módulo."""
    privada = Ed25519PrivateKey.generate()
    pem = privada.public_key().public_bytes(
        Encoding.PEM, PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setitem(rcslic.LLAVERO, LLAVE, pem)
    return privada


def escribir(tmp_path, privada, contenido=None, *, llave=LLAVE,
             formato="rcslic/1", nombre="licencia.rcslic", romper=None) -> Path:
    texto = json.dumps(contenido if contenido is not None else CONTENIDO,
                       ensure_ascii=False)
    firma = base64.b64encode(privada.sign(texto.encode("utf-8"))).decode()

    sobre = {"formato": formato, "llave": llave,
             "contenido": texto, "firma": firma}
    if romper:
        sobre = romper(sobre)

    archivo = tmp_path / nombre
    archivo.write_text(json.dumps(sobre, indent=4, ensure_ascii=False),
                       encoding="utf-8")
    return archivo


# ── Lo que debe pasar ────────────────────────────────────────

def test_una_licencia_buena_se_lee(tmp_path, firmante):
    lic = rcslic.leer(escribir(tmp_path, firmante))

    assert lic.codigo == "RCS-2026-0001"
    assert lic.cliente == "Autódromo de Pruebas"
    assert lic.plan == "demo"
    assert lic.horas_demo == 48
    assert lic.check_in_dias == 15
    assert lic.vence is None
    assert lic.es_demo
    assert not lic.perpetua
    assert lic.emitida.isoformat() == "2026-09-30"


def test_un_plan_con_fecha_no_es_demo(tmp_path, firmante):
    lic = rcslic.leer(escribir(tmp_path, firmante,
                               {**CONTENIDO, "plan": "platinum", "vence": "2027-09-30",
                                "horas_demo": None, "plus": True}))
    assert not lic.es_demo
    assert not lic.perpetua
    assert lic.plus
    assert lic.vence.isoformat() == "2027-09-30"


def test_el_resumen_no_lleva_la_firma(tmp_path, firmante):
    r = rcslic.leer(escribir(tmp_path, firmante)).resumen()
    assert "firma" not in r and "contenido" not in r
    assert r["codigo"] == "RCS-2026-0001"


# ── Lo que NO debe pasar ─────────────────────────────────────

def test_contenido_retocado_despues_de_firmar(tmp_path, firmante):
    """El ataque obvio: cambiarse el plan a mano."""
    def subirse_el_plan(sobre):
        datos = json.loads(sobre["contenido"])
        datos["plan"] = "platinum"
        datos["vence"] = "2099-01-01"
        sobre["contenido"] = json.dumps(datos, ensure_ascii=False)
        return sobre

    with pytest.raises(rcslic.LicenciaInvalida, match="firma.*no es válida"):
        rcslic.leer(escribir(tmp_path, firmante, romper=subirse_el_plan))


def test_firma_de_otra_clave(tmp_path, firmante, monkeypatch):
    """Firmada de verdad, pero por quien no es Zentogo."""
    otra = Ed25519PrivateKey.generate()
    archivo = escribir(tmp_path, otra)
    with pytest.raises(rcslic.LicenciaInvalida, match="firma.*no es válida"):
        rcslic.leer(archivo)


def test_clave_desconocida(tmp_path, firmante):
    with pytest.raises(rcslic.LicenciaInvalida, match="no conoce"):
        rcslic.leer(escribir(tmp_path, firmante, llave="inventada-9999"))


def test_sin_llavero_no_se_acepta_nada(tmp_path, firmante, monkeypatch):
    """Empaquetado sin clave pública: rechaza, nunca deja pasar."""
    monkeypatch.setattr(rcslic, "LLAVERO", {})
    with pytest.raises(rcslic.LicenciaInvalida, match="clave de verificación"):
        rcslic.leer(escribir(tmp_path, firmante))


def test_formato_de_sobre_distinto(tmp_path, firmante):
    with pytest.raises(rcslic.LicenciaInvalida, match="Formato de licencia desconocido"):
        rcslic.leer(escribir(tmp_path, firmante, formato="rcslic/9"))


def test_contenido_de_version_nueva(tmp_path, firmante):
    with pytest.raises(rcslic.LicenciaInvalida, match="no entiende"):
        rcslic.leer(escribir(tmp_path, firmante, {**CONTENIDO, "formato": 99}))


def test_falta_un_campo_del_sobre(tmp_path, firmante):
    for campo in ("llave", "contenido", "firma"):
        def quitar(sobre, c=campo):
            sobre.pop(c)
            return sobre
        with pytest.raises(rcslic.LicenciaInvalida, match=f"falta «{campo}»"):
            rcslic.leer(escribir(tmp_path, firmante, romper=quitar))


def test_firma_que_no_es_base64(tmp_path, firmante):
    with pytest.raises(rcslic.LicenciaInvalida, match="dañada"):
        rcslic.leer(escribir(tmp_path, firmante,
                             romper=lambda s: {**s, "firma": "no es base64 @@@"}))


def test_otra_extension_no_se_abre(tmp_path, firmante):
    archivo = escribir(tmp_path, firmante, nombre="licencia.txt")
    with pytest.raises(rcslic.LicenciaInvalida, match=r"\.rcslic"):
        rcslic.leer(archivo)


def test_archivo_que_no_es_json(tmp_path):
    malo = tmp_path / "cualquiera.rcslic"
    malo.write_text("esto no es una licencia", encoding="utf-8")
    with pytest.raises(rcslic.LicenciaInvalida, match="dañado"):
        rcslic.leer(malo)


def test_archivo_que_no_existe(tmp_path):
    with pytest.raises(rcslic.LicenciaInvalida, match="No existe"):
        rcslic.leer(tmp_path / "ninguna.rcslic")


def test_fecha_imposible(tmp_path, firmante):
    with pytest.raises(rcslic.LicenciaInvalida, match="fecha que no se entiende"):
        rcslic.leer(escribir(tmp_path, firmante, {**CONTENIDO, "vence": "32 de mayo"}))


def test_sin_fecha_de_emision(tmp_path, firmante):
    with pytest.raises(rcslic.LicenciaInvalida, match="cuándo se emitió"):
        rcslic.leer(escribir(tmp_path, firmante, {**CONTENIDO, "emitida": None}))
