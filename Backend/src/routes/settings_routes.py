from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from src.services.auth_services import puede_escribir
from src.services.settings_services import (
    guardar_ruta_timing, revisar_ruta, ruta_timing, xml_detectados,
)
from src.services.tracks_services import ruta_plantilla, trazados_service

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


# ======================================================================
#  TRAZADOS
#
#  La imagen de la pista no es un ajuste suelto sino una lista: el mismo
#  recinto se corre de varias formas —pista corta, pista larga, cuarto de
#  milla— y cada una tiene su dibujo. Se marca uno como activo y es el que
#  sale en el gráfico de Circuito.
# ======================================================================


class TrazadoIn(BaseModel):
    name: str
    variante: Optional[str] = None
    discipline: str = "circuito"
    length_km: Optional[float] = None


class TrazadoPatch(BaseModel):
    name: Optional[str] = None
    variante: Optional[str] = None
    discipline: Optional[str] = None
    length_km: Optional[float] = None


class RutaImagen(BaseModel):
    ruta: str


def _salida(doc) -> dict:
    """Se añade la ruta que entiende la plantilla, que es lo que consume
    la vista previa del navegador y el propio gráfico."""
    return {
        **doc.model_dump(exclude={"id"}),
        "image_url": ruta_plantilla(doc.image),
    }


@ajustes.get("/trazados", tags=["Settings"])
async def listar_trazados(discipline: Optional[str] = None):
    """
    Trazados dados de alta, con cuál está activo
    """
    docs = await trazados_service.listar(discipline)
    return {"items": [_salida(d) for d in docs], "total": len(docs)}


@ajustes.post("/trazados", tags=["Settings"], status_code=201,
              dependencies=[Depends(puede_escribir)])
async def crear_trazado(datos: TrazadoIn):
    """
    Da de alta un trazado. La imagen se sube después, por su id
    """
    doc = await trazados_service.crear(datos.model_dump())
    return _salida(doc)


@ajustes.put("/trazados/{trazado_id}", tags=["Settings"],
             dependencies=[Depends(puede_escribir)])
async def editar_trazado(trazado_id: int, datos: TrazadoPatch):
    """
    Cambia el nombre, la variante, la disciplina o la longitud
    """
    doc = await trazados_service.actualizar(
        trazado_id, datos.model_dump(exclude_unset=True))
    return _salida(doc)


@ajustes.put("/trazados/{trazado_id}/activar", tags=["Settings"],
             dependencies=[Depends(puede_escribir)])
async def activar_trazado(trazado_id: int):
    """
    Marca este trazado como el que sale en el gráfico de Circuito
    """
    doc = await trazados_service.activar(trazado_id)
    return _salida(doc)


@ajustes.post("/trazados/{trazado_id}/imagen", tags=["Settings"],
              dependencies=[Depends(puede_escribir)])
async def subir_imagen(trazado_id: int, archivo: UploadFile = File(...)):
    """
    Sube la imagen del trazado desde el navegador
    """
    contenido = await archivo.read()
    doc = await trazados_service.subir_imagen(
        trazado_id, archivo.filename or "", contenido)
    return _salida(doc)


@ajustes.put("/trazados/{trazado_id}/imagen", tags=["Settings"],
             dependencies=[Depends(puede_escribir)])
async def imagen_por_ruta(trazado_id: int, datos: RutaImagen):
    """
    Toma la imagen de una ruta del servidor y la copia a la plantilla
    """
    doc = await trazados_service.copiar_imagen(trazado_id, datos.ruta)
    return _salida(doc)


@ajustes.delete("/trazados/{trazado_id}", tags=["Settings"],
                dependencies=[Depends(puede_escribir)])
async def borrar_trazado(trazado_id: int):
    """
    Borra el trazado y su imagen, si no la usa ningún otro
    """
    return await trazados_service.borrar(trazado_id)
