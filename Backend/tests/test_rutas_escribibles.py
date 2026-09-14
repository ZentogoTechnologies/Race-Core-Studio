"""Que lo que se escribe caiga donde se puede escribir, y donde se busca.

Este archivo existe por un fallo concreto. Instalado, el token del
asistente acababa dentro de «Archivos de programa» —la carpeta del
backend congelado—, dos veces mal: allí un usuario normal no puede
escribir, y el lanzador lo buscaba en ProgramData, así que abría el
asistente sin token y el cliente veía «Falta el token de instalación»
sin nada que pudiera hacer al respecto.

Sin congelar no se notaba: ahí las dos carpetas son la misma.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import rutas                                                     # noqa: E402
from config import ruta_del_backend, settings                    # noqa: E402


def test_lo_relativo_cae_en_datos():
    assert ruta_del_backend("licencia.lic").parent == rutas.DATOS


def test_lo_absoluto_se_respeta(tmp_path):
    suyo = tmp_path / "otro-disco" / "licencia.lic"
    assert ruta_del_backend(str(suyo)) == suyo


def test_las_tres_rutas_que_se_escriben_van_a_datos():
    """Token, licencia y estado: las tres se escriben en marcha."""
    for valor in (settings.SETUP_TOKEN_FILE,
                  settings.LICENSE_FILE,
                  settings.LICENSE_STATE_FILE):
        assert ruta_del_backend(valor).parent == rutas.DATOS, valor


def test_el_lanzador_busca_el_token_donde_el_backend_lo_deja():
    """Las dos mitades tienen que coincidir, y se congelan por separado.

    El lanzador no importa Backend/rutas.py —no lo lleva dentro—, así que
    duplica el cálculo de la carpeta de datos. Si una de las dos copias
    cambia sin la otra, el token vuelve a perderse.
    """
    lanzador = (RAIZ.parent / "launcher" / "race_core_studio.py").read_text(
        encoding="utf-8")

    assert 'rutas_de_datos() / "instalacion.token"' in lanzador
    assert "def url_del_panel()" in lanzador
    assert "instalacion?token=" in lanzador
