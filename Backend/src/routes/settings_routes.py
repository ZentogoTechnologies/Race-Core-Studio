from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.services.auth_services import puede_escribir
from src.services.settings_services import (
    guardar_ruta_timing, revisar_ruta, ruta_timing, xml_detectados,
)

ajustes = APIRouter()


class RutaTiming(BaseModel):
    # Vacío o None vuelve a la ruta del .env.
    timing_xml_path: Optional[str] = None


@ajustes.get("/", tags=["Settings"])
async def leer_ajustes():
    """
    Ajustes en vigor y los XML que el servidor alcanza
    """
    actual = ruta_timing()
    return {
        "timing_xml_path": actual,
        "estado": revisar_ruta(actual),
        "detectados": xml_detectados(),
    }


@ajustes.post("/timing/probar", tags=["Settings"], dependencies=[Depends(puede_escribir)])
async def probar(datos: RutaTiming):
    """
    Comprueba una ruta sin aplicarla. Dice qué evento y tanda trae
    """
    return revisar_ruta(datos.timing_xml_path or "")


@ajustes.put("/timing", tags=["Settings"], dependencies=[Depends(puede_escribir)])
async def cambiar_ruta(datos: RutaTiming):
    """
    Cambia la ruta del current.xml. Se aplica de inmediato, sin reiniciar
    """
    aplicada = await guardar_ruta_timing(datos.timing_xml_path)
    actual = ruta_timing()
    return {
        "timing_xml_path": actual,
        "usando_env": aplicada is None,
        "estado": revisar_ruta(actual),
    }
