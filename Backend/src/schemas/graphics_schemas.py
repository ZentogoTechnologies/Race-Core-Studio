from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


# ── Peticiones ────────────────────────────────────────────────

class PlayRequest(BaseModel):
    """
    Saca un gráfico al aire.

    Para las fichas de piloto basta con mandar `pilot_id`: el backend
    arma el payload desde la base. `data` es para pasar campos a mano,
    o para completar los que el backend no conoce.
    """

    graphic_id: str = Field(..., description="Id del gráfico, el mismo que usa el botón del frontend")
    pilot_id: Optional[int] = Field(None, description="Piloto con el que alimentar la plantilla")

    # Desde qué categoría se está graficando al piloto. Solo importa cuando
    # corre en varias con carros distintos: sin esto se tomaba un vehículo
    # cualquiera de los suyos.
    category_id: Optional[int] = Field(None, description="Categoría desde la que se grafica al piloto")

    data: Optional[dict[str, Any]] = Field(None, description="Datos que recibirá update() en la plantilla")


class UpdateRequest(BaseModel):
    """Refresca los datos de un gráfico que ya está al aire."""

    graphic_id: str
    pilot_id: Optional[int] = None

    # Desde qué categoría se está graficando al piloto. Solo importa
    # cuando corre en varias con carros distintos: sin esto se tomaba un
    # vehículo cualquiera de los suyos.
    category_id: Optional[int] = None
    data: Optional[dict[str, Any]] = None

    @model_validator(mode="after")
    def check_payload(self):
        if self.pilot_id is None and not self.data:
            raise ValueError("Indica pilot_id o data")
        return self


class ClearRequest(BaseModel):
    """
    Saca de aire una capa. Se puede indicar por gráfico o por grupo;
    en ambos casos se limpia la capa entera.
    """

    graphic_id: Optional[str] = None
    group: Optional[str] = Field(None, description="background, totem, flag, grid, pilot o misc")

    @model_validator(mode="after")
    def check_target(self):
        if not self.graphic_id and not self.group:
            raise ValueError("Indica graphic_id o group")
        return self


# ── Respuestas ────────────────────────────────────────────────

class TemplateResponse(BaseModel):
    graphic_id: str
    name: str
    group: str
    layer: int
    path: str
    accepts_data: bool


class GraphicResponse(BaseModel):
    """Resultado de un comando, con lo que contestó CasparCG."""

    ok: bool = True
    graphic_id: Optional[str] = None
    layer: Optional[int] = None

    command: str = Field(..., description="Comando AMCP que se envió")
    code: int = Field(..., description="Código de respuesta AMCP (202 = OK)")
    status: str = Field(..., description="Línea de estado devuelta por CasparCG")

    on_air: dict[str, str] = Field(default_factory=dict, description="Gráfico al aire por grupo")


class StateResponse(BaseModel):
    connected: bool
    host: str
    port: int
    channel: int
    on_air: dict[str, str] = Field(default_factory=dict)
