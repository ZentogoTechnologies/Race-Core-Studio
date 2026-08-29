import xml.etree.ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import settings
from typing import Optional

from src.services.auth_services import usuario_actual
from src.services.timing_services import (
    carros_en_pista,
    elegir_piloto,
    leer_xml,
    obtener_clasificacion,
    reloj_arrancar,
    reloj_configurar,
    reloj_estado,
    reloj_pausar,
    reloj_reiniciar,
    reloj_vuelta,
)


class Duracion(BaseModel):
    """Duración de la cuenta atrás. Si no viene, se toma la del XML."""

    duracion: Optional[str] = None


class Configuracion(BaseModel):
    """Cómo se mide la tanda: por tiempo o por vueltas."""

    modo: Optional[str] = Field(None, description="tiempo o vueltas")
    duracion: Optional[str] = Field(None, description="mm:ss o hh:mm:ss")
    vueltas_total: Optional[int] = Field(None, ge=0, le=999)


class Vuelta(BaseModel):
    """Suma o resta vueltas, o las fija de golpe con `absoluta`."""

    delta: int = 1
    absoluta: Optional[int] = Field(None, ge=0, le=999)


class PilotoActivo(BaseModel):
    """Cuál de los dos pilotos de un carro compartido va manejando."""

    vehicle_id: int
    pilot_id: int

timing = APIRouter()

# /current es lo unico que consultan las plantillas de CasparCG, que corren
# desde file:// y no tienen donde guardar un token. Es lectura pura del XML
# de MyLaps. Todo lo demas de este modulo son ordenes del panel del operador
# (arrancar el reloj, pausarlo, elegir quien maneja) y esas si van firmadas.
OPERADOR = [Depends(usuario_actual)]


@timing.get("/current", tags=["Timing"])
async def current(
    limit: int = Query(10, ge=1, le=50, description="Cuántas posiciones devolver"),
):
    """
    Clasificación en vivo desde el current.xml de MyLaps.

    Las plantillas del tótem consultan esto en bucle, así que la respuesta
    se marca como no cacheable: si el navegador la guardara, el reloj de
    carrera se quedaría congelado.
    """
    try:
        datos = await obtener_clasificacion(limite=limit)

    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=f"No se encuentra el archivo de cronometraje en {settings.TIMING_XML_PATH}",
        )

    except ET.ParseError as exc:
        # MyLaps reescribe el archivo entero: si se lee justo en ese
        # instante queda a medias. No es un error real, se reintenta.
        raise HTTPException(
            status_code=503,
            detail=f"El current.xml se leyó mientras MyLaps lo escribía ({exc})",
        )

    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo leer el archivo de cronometraje: {exc}",
        )

    return JSONResponse(
        content=datos,
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@timing.get("/raw", tags=["Timing"], dependencies=OPERADOR)
async def raw():
    """
    Los labels del XML y el conteo de filas, tal cual vienen.

    Sirve para comprobar que el archivo se está leyendo y ver qué manda
    MyLaps sin el cruce contra la base de por medio.
    """
    try:
        crudo = leer_xml()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail=f"No existe {settings.TIMING_XML_PATH}")
    except (ET.ParseError, OSError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {
        "path": settings.TIMING_XML_PATH,
        "modificado": crudo["modificado"],
        "labels": crudo["labels"],
        "filas": len(crudo["filas"]),
    }


@timing.get("/lineup", tags=["Timing"], dependencies=OPERADOR)
async def lineup():
    """
    Los carros de la tanda actual con sus pilotos.

    El panel del frontend lo usa para dejar elegir quién va manejando en
    los carros compartidos, que es algo que MyLaps no distingue.
    """
    try:
        carros = await carros_en_pista()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=f"No se encuentra el archivo de cronometraje en {settings.TIMING_XML_PATH}",
        )
    except (ET.ParseError, OSError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return JSONResponse(
        content={"carros": carros},
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@timing.post("/driver", tags=["Timing"], dependencies=OPERADOR)
async def driver(request: PilotoActivo):
    """Fija el piloto que se muestra en el tótem para ese carro."""
    try:
        return await elegir_piloto(request.vehicle_id, request.pilot_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Cuenta atrás ──────────────────────────────────────────────
# El reloj lo lleva el backend, no las plantillas: así los cuatro tótems
# muestran el mismo número y no se van separando entre ellos.

@timing.get("/timer", tags=["Timing"], dependencies=OPERADOR)
async def timer():
    """Cómo va la cuenta atrás ahora mismo."""
    return JSONResponse(
        content=reloj_estado(),
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@timing.post("/timer/start", tags=["Timing"], dependencies=OPERADOR)
async def timer_start(request: Duracion | None = None):
    """
    Arranca la cuenta atrás.

    Si estaba pausada sigue desde donde iba; si estaba parada empieza con
    la duración que diga el `timetogo` del XML.
    """
    return reloj_arrancar(request.duracion if request else None)


@timing.post("/timer/pause", tags=["Timing"], dependencies=OPERADOR)
async def timer_pause():
    """Detiene la cuenta atrás sin perder lo que quedaba."""
    return reloj_pausar()


@timing.post("/timer/reset", tags=["Timing"], dependencies=OPERADOR)
async def timer_reset(request: Duracion | None = None):
    """Vuelve a la duración de la tanda y deja el reloj parado."""
    return reloj_reiniciar(request.duracion if request else None)


@timing.post("/timer/config", tags=["Timing"], dependencies=OPERADOR)
async def timer_config(request: Configuracion):
    """
    Fija el modo y los valores de la tanda.

    Cambiar la duración detiene el reloj a propósito: cambiarla en marcha
    haría saltar el número en pantalla en mitad de la carrera.
    """
    if request.modo is not None and request.modo not in ("tiempo", "vueltas"):
        raise HTTPException(
            status_code=400,
            detail="El modo tiene que ser 'tiempo' o 'vueltas'",
        )

    return reloj_configurar(
        modo=request.modo,
        duracion=request.duracion,
        vueltas_total=request.vueltas_total,
    )


@timing.post("/timer/lap", tags=["Timing"], dependencies=OPERADOR)
async def timer_lap(request: Vuelta):
    """Avanza o retrocede la vuelta en curso."""
    return reloj_vuelta(delta=request.delta, absoluta=request.absoluta)
