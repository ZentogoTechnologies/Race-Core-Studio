"""Lo que el gráfico de patrocinadores necesita saber.

Una sola ruta, y abierta. Es la misma excepción que ya existe para
GET /timing/current: las plantillas corren dentro de CasparCG, que las
abre desde file://, y desde ahí no pueden mandar una cabecera
Authorization. Lo mismo pasa con /public, que sirve las fotos con <img>.

Se consulta cada pocos segundos en vez de recibir la lista una sola vez
al salir al aire. Así, subir un patrocinador a mitad de evento lo mete en
la rotación sin tener que bajar el gráfico y volverlo a subir, que en
directo significa un parpadeo en la esquina.

Lo que devuelve son nombres de archivo de logos que ya se sirven
abiertamente en /public: no hay nada aquí que no estuviera expuesto.
"""

from fastapi import APIRouter

from config import settings
from src.services.settings_services import (
    patrocinadores_actuales,
    segundos_patrocinadores,
    url_logo_cliente,
    url_patrocinador,
)

patrocinadores = APIRouter()


def _absoluta(ruta: str) -> str:
    """CasparCG abre la plantilla desde file://, donde una ruta que
    empieza por / apunta a la raíz del disco y la imagen no carga nunca.
    Tiene que viajar con host y puerto."""
    if not ruta:
        return ""
    return f"{settings.PUBLIC_BASE_URL}{ruta}"


@patrocinadores.get("/", tags=["Sponsors"])
async def listar():
    """El logo del autódromo y los patrocinadores, en su orden."""
    nombres = await patrocinadores_actuales()

    return {
        # Va quemado junto a los patrocinadores, fijo mientras ellos
        # rotan. Es el mismo archivo que usan los otros veintidós
        # gráficos, así que cambiarlo en Ajustes lo cambia también aquí.
        "logo": _absoluta(url_logo_cliente()),
        "patrocinadores": [
            {"nombre": n, "url": _absoluta(url_patrocinador(n))}
            for n in nombres
        ],
        "segundos": await segundos_patrocinadores(),
    }
