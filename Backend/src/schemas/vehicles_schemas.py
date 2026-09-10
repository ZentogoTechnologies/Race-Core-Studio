from pydantic import BaseModel, Field, field_validator, validator
from typing import Optional, List

from src.services.marcas_services import normalizar as _normalizar_marca


def _canonica(valor: Optional[str]) -> Optional[str]:
    """El nombre de catalogo de una marca, o lo que llegue si no esta.

    Antes la marca era texto libre y en la base convivian "Bmw" y "BMW"
    como si fueran dos marcas. Peor: el logo se busca por el nombre, asi
    que "Mc Laren" no encontraba mclaren.png y el grafico salia sin logo
    sin que nadie se enterara.

    Se devuelve el nombre canonico y no lo que llegue: da igual como lo
    mande quien llame -"bmw", "BMW" o "Bmw"- que en la base queda uno solo
    y su logo se encuentra siempre.
    """
    if valor is None or not valor.strip():
        return None

    return _normalizar_marca(valor) or valor.strip()


def _marca_nueva(valor: Optional[str]) -> Optional[str]:
    """Un vehiculo que se da de alta tiene que traer una marca del catalogo.

    Aqui se es estricto porque no hay nada que perder: es un registro que
    todavia no existe. La lista cerrada empieza a valer desde el primero
    que se inscriba de aqui en adelante.
    """
    limpio = _canonica(valor)

    if limpio is not None and _normalizar_marca(limpio) is None:
        raise ValueError(
            f"'{valor}' no esta en el catalogo de marcas. Elige una de la "
            "lista; si falta, hay que agregarla al catalogo."
        )
    return limpio


def _marca_existente(valor: Optional[str]) -> Optional[str]:
    """Al editar, lo que ya estaba guardado se respeta aunque no este en la lista.

    Hay vehiculos inscritos desde antes con cosas que no son marcas -"rush"
    era la categoria, "00" era el dorsal repetido-. Rechazarlas aqui no las
    arregla: deja el vehiculo sin poder guardarse, asi que ni siquiera se
    le pueden cambiar las fotos hasta tocar la marca.

    Que nadie pueda inscribir una marca inventada ya lo garantiza el panel,
    donde la marca solo se puede elegir de la lista. Esto es el respaldo de
    lo que hay, no la puerta de entrada.
    """
    return _canonica(valor)


class VehicleCreate(BaseModel):
    # Opcional: lo pone el servicio. `number` es el dorsal de carrera y ese
    # sí lo escribe quien inscribe; este es solo la clave interna.
    vehicle_id: Optional[int] = None
    # Sin dorsal se puede: en drag no todos los carros llevan numero.
    number: Optional[int] = None
    display_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None

    pilot_ids: List[int] = [] # Recibimos hasta 2 IDs. En service validamos max 2
    category_id: int
    sub_category_id: Optional[int] = None

    @validator('pilot_ids')
    def max_two_pilots(cls, v):
        if len(v) > 2:
            raise ValueError('Un vehículo no puede tener más de 2 pilotos')
        return v

    _valida_marca = field_validator("brand")(_marca_nueva)

class VehicleUpdate(BaseModel):
    number: Optional[int] = None
    display_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    pilot_ids: Optional[List[int]] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None

    _valida_marca = field_validator("brand")(_marca_existente)

class VehicleResponse(BaseModel):
    id: str = Field(alias="_id")
    vehicle_id: int
    number: Optional[int] = None
    display_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None

    photos: List[str] = []        # nombres de archivo, en orden
    photo_urls: List[str] = []    # las mismas, ya resueltas para <img>

    pilots: List[dict] = [] # [{"pilot_id": 1, "name": "Juan", "team_brand": "Zentogo"}]
    active_pilot_id: Optional[int] = None
    category_id: int
    category_name: Optional[str] = None
    sub_category_id: Optional[int] = None
    sub_category_name: Optional[str] = None

    is_active: bool

    class Config:
        populate_by_name = True