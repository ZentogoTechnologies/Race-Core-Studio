from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

TipoSesion = Literal["practice", "qualy", "heat"]

# Cómo se nombra cada tipo al mostrarlo.
ETIQUETAS = {"practice": "Practice", "qualy": "Qualy", "heat": "Heat"}


def _validar_fecha(valor: str) -> str:
    """Acepta solo YYYY-MM-DD.

    Se comprueba aquí y no en el modelo porque un formato distinto rompe
    la comparación de días y el cálculo de la duración, y conviene que
    falle en la petición y no al leer el documento.
    """
    try:
        date.fromisoformat(valor)
    except (ValueError, TypeError):
        raise ValueError("la fecha debe tener el formato YYYY-MM-DD")
    return valor


class InscritoIn(BaseModel):
    vehicle_id: int
    pilot_ids: List[int] = []


class InscritoOut(BaseModel):
    vehicle_id: int
    pilot_ids: List[int] = []
    category_id: int
    sub_category_id: Optional[int] = None

    # Resueltos por el servicio para no obligar al frontend a cruzar
    # tres listados solo para pintar una fila.
    numero: Optional[int] = None
    display_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    category_name: Optional[str] = None
    sub_category_name: Optional[str] = None
    pilotos: List[dict] = []


class SesionIn(BaseModel):
    dia: str
    tipo: TipoSesion
    category_ids: List[int] = Field(default_factory=list, min_length=1)
    libre: bool = False
    vehicle_ids: List[int] = []

    _fecha = field_validator("dia")(_validar_fecha)

    @model_validator(mode="after")
    def coherencia(self):
        # Una sesión de una sola categoría no es libre, y una libre con
        # una sola categoría es una práctica normal mal etiquetada.
        if self.libre and len(self.category_ids) < 2:
            raise ValueError("una práctica libre necesita al menos dos categorías")
        if not self.libre and len(self.category_ids) != 1:
            raise ValueError("una sesión normal corre una sola categoría")
        if self.libre and self.tipo != "practice":
            raise ValueError("solo las prácticas pueden ser libres")
        return self


class SesionOut(BaseModel):
    numero_orden: int
    dia: str
    tipo: str
    category_ids: List[int] = []
    libre: bool = False
    numero: int = 1
    nombre: str = ""
    vehicle_ids: List[int] = []
    categorias: List[str] = []         # nombres resueltos


class EventCreate(BaseModel):
    # Opcional: si no viene, el servicio toma el siguiente libre, igual
    # que en categorías.
    event_id: Optional[int] = None
    name: str = Field(min_length=2)
    start_date: str
    end_date: str
    discipline: str = "circuito"
    location: Optional[str] = None
    category_ids: List[int] = []
    inscritos: List[InscritoIn] = []

    _inicio = field_validator("start_date")(_validar_fecha)
    _fin = field_validator("end_date")(_validar_fecha)

    @model_validator(mode="after")
    def rango(self):
        if date.fromisoformat(self.end_date) < date.fromisoformat(self.start_date):
            raise ValueError("la fecha final no puede ser anterior a la inicial")
        return self


class EventUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    category_ids: Optional[List[int]] = None
    inscritos: Optional[List[InscritoIn]] = None
    is_active: Optional[bool] = None

    @field_validator("start_date", "end_date")
    @classmethod
    def formato(cls, v):
        return _validar_fecha(v) if v is not None else v


class EventResponse(BaseModel):
    event_id: int
    name: str
    start_date: str
    end_date: str
    discipline: str
    location: Optional[str] = None

    category_ids: List[int] = []
    categorias: List[str] = []         # nombres, para la tabla
    inscritos: List[InscritoOut] = []
    sesiones: List[SesionOut] = []

    dias: List[str] = []               # calculado del rango
    total_dias: int = 0
    total_inscritos: int = 0
    total_sesiones: int = 0

    is_active: bool = True
