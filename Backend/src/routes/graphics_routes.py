from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from config import settings
from src.schemas.graphics_schemas import (
    ClearRequest,
    GraphicResponse,
    PlayRequest,
    StateResponse,
    TemplateResponse,
    UpdateRequest,
)
from src.services.casparcg_client import (
    CasparCGError,
    CasparCGUnavailable,
    casparcg,
)
from src.services.graphics_services import LAYERS, build_pilot_payload, service

graphics = APIRouter()


# ── Ayudas ────────────────────────────────────────────────────

def _resolve(graphic_id: str):
    template = service.get_template(graphic_id)
    if template is None:
        raise HTTPException(status_code=404, detail=f"Gráfico '{graphic_id}' no existe")
    return template


async def _payload(template, pilot_id: Optional[int], data: Optional[dict]) -> Optional[dict]:
    """
    Arma los datos que recibirá la plantilla.

    Si viene un pilot_id, el backend los saca de la base; lo que llegue en
    `data` se aplica encima, para poder corregir un campo puntual sin
    tener que mandar el resto.
    """
    if pilot_id is None:
        return data

    payload = await build_pilot_payload(template.graphic_id, pilot_id)
    if data:
        payload.update(data)
    return payload


async def _run(coro, graphic_id: str = None, layer: int = None) -> GraphicResponse:
    """
    Ejecuta un comando traduciendo los fallos de CasparCG a HTTP.

    503 si el servidor de video no responde (apagado o sin red) y 502 si
    responde pero rechaza el comando. Así el frontend puede distinguir
    "no hay servidor" de "el comando estaba mal".
    """
    try:
        result = await coro

    except CasparCGUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    except CasparCGError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"CasparCG rechazó el comando: {exc.status} ({exc.command})",
        ) from exc

    return GraphicResponse(
        ok=True,
        graphic_id=graphic_id,
        layer=layer,
        command=result["command"],
        code=result["code"],
        status=result["status"],
        on_air=service.on_air(),
    )


# ── Catálogo y estado ─────────────────────────────────────────

@graphics.get("/templates", tags=["Graphics"], response_model=list[TemplateResponse])
async def list_templates(
    group: Optional[str] = Query(None, description="Filtrar por grupo: background, totem, flag, grid, pilot, misc")
):
    """
    Devuelve el catálogo de plantillas con su capa y su ruta.

    El frontend puede usarlo para validar que sus botones coinciden con
    lo que el backend sabe graficar.
    """
    return [TemplateResponse(**t.__dict__) for t in service.list_templates(group)]


@graphics.get("/state", tags=["Graphics"], response_model=StateResponse)
async def get_state():
    """Qué gráfico hay al aire en cada capa y si la conexión sigue viva."""
    return StateResponse(
        connected=casparcg.is_connected,
        host=casparcg.host,
        port=casparcg.port,
        channel=settings.CASPARCG_CHANNEL,
        on_air=service.on_air(),
    )


# ── Comandos ──────────────────────────────────────────────────

@graphics.post("/play", tags=["Graphics"], response_model=GraphicResponse)
async def play_graphic(request: PlayRequest):
    """
    Saca un gráfico al aire: CG <canal>-<capa> ADD 1 "<plantilla>" 1.

    Espera la respuesta de CasparCG antes de contestar, así el frontend
    solo marca el botón como activo cuando el gráfico salió de verdad.
    """
    template = _resolve(request.graphic_id)

    data = await _payload(template, request.pilot_id, request.data)

    if data and not template.accepts_data:
        raise HTTPException(
            status_code=400,
            detail=f"La plantilla '{template.graphic_id}' no recibe datos",
        )

    return await _run(
        service.play(template, data),
        graphic_id=template.graphic_id,
        layer=template.layer,
    )


@graphics.post("/update", tags=["Graphics"], response_model=GraphicResponse)
async def update_graphic(request: UpdateRequest):
    """
    Refresca los datos de un gráfico ya al aire sin recargar la plantilla:
    CG <canal>-<capa> UPDATE 1 "<datos>".
    """
    template = _resolve(request.graphic_id)

    if not template.accepts_data:
        raise HTTPException(
            status_code=400,
            detail=f"La plantilla '{template.graphic_id}' no recibe datos",
        )

    data = await _payload(template, request.pilot_id, request.data)

    return await _run(
        service.update(template, data),
        graphic_id=template.graphic_id,
        layer=template.layer,
    )


@graphics.post("/clear", tags=["Graphics"], response_model=GraphicResponse)
async def clear_layer(request: ClearRequest):
    """
    Limpia una capa: CLEAR <canal>-<capa>.

    Se puede pedir por gráfico ("saca esto de aire") o por grupo
    ("limpia los fondos"); en los dos casos se limpia la capa completa.
    """
    if request.graphic_id:
        layer = _resolve(request.graphic_id).layer
    else:
        layer = LAYERS.get(request.group)
        if layer is None:
            raise HTTPException(
                status_code=404,
                detail=f"Grupo '{request.group}' no existe. Válidos: {', '.join(LAYERS)}",
            )

    return await _run(service.clear_layer(layer), layer=layer)


@graphics.post("/clear-all", tags=["Graphics"], response_model=GraphicResponse)
async def clear_all():
    """Saca todo de aire: CLEAR <canal>."""
    return await _run(service.clear_all())
