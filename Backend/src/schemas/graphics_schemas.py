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

    # Para el gráfico de Evento: el nombre y la imagen salen de la base.
    event_id: Optional[int] = Field(None, description="Evento que se está graficando")

    # Segundo piloto de la carta VS. Solo lo usa ese gráfico.
    pilot_id_2: Optional[int] = Field(None, description="Segundo piloto, para la carta VS")

    data: Optional[dict[str, Any]] = Field(None, description="Datos que recibirá update() en la plantilla")


class UpdateRequest(BaseModel):
    """Refresca los datos de un gráfico que ya está al aire."""

    graphic_id: str
    pilot_id: Optional[int] = None

    # Desde qué categoría se está graficando al piloto. Solo importa
    # cuando corre en varias con carros distintos: sin esto se tomaba un
    # vehículo cualquiera de los suyos.
    category_id: Optional[int] = None
    event_id: Optional[int] = None
    pilot_id_2: Optional[int] = None
    data: Optional[dict[str, Any]] = None

    @model_validator(mode="after")
    def check_payload(self):
        if self.pilot_id is None and not self.data:
            raise ValueError("Indica pilot_id o data")
        return self


class DesarmarRequest(BaseModel):
    """Qué grupo deja de esperar turno."""

    group: str


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

    # Lo que acaba de recibir la plantilla, para el monitor de aire del
    # panel. Viaja de vuelta en la misma respuesta y no en una peticion
    # aparte: pedirlo otra vez volveria a resolver el clima contra su
    # servicio externo y a releer el cronometraje, y ademas podria
    # devolver algo distinto de lo que de verdad salio.
    data: Optional[dict] = None
    path: Optional[str] = None


class StateResponse(BaseModel):
    connected: bool
    host: str
    port: int
    channel: int
    on_air: dict[str, str] = Field(default_factory=dict)

    # Lo mismo con la ruta de la plantilla y los datos de cada capa, de
    # atras hacia delante. Con esto cualquier navegador reconstruye la
    # composicion que esta saliendo, sin haber sido el que la mando.
    al_aire: list[dict] = Field(default_factory=list)

    # Lo que espera turno, por grupo, para que el panel pinte sus botones
    # en ambar. Un valor nulo quiere decir que esa capa se apaga.
    armado: dict[str, dict | None] = Field(default_factory=dict)

    # Y la composicion que saldria si se mandara ahora: el aire con lo
    # armado encima. La calcula el backend para que el panel y el monitor
    # no puedan discrepar sobre lo mismo.
    previo: list[dict] = Field(default_factory=list)
