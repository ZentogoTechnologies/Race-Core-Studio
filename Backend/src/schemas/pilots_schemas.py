from pydantic import BaseModel, Field, field_validator
from typing import Dict, Optional, List

from src.services.settings_services import PAISES_CON_BANDERA


def _pais(valor: Optional[str]) -> Optional[str]:
    """La nacionalidad es un codigo ISO 3166-1 alfa-2, en minusculas.

    Se guarda el codigo y no el nombre porque el nombre cambia con el
    idioma y se escribe de varias maneras —"Panama", "Panama", "PANAMA"—,
    y asi cada variante era un pais distinto. El codigo ademas es el
    nombre del archivo de la bandera.

    Se valida contra las banderas que hay en disco: un codigo sin bandera
    saldria al aire como una imagen rota.
    """
    if valor is None or valor == "":
        return None

    codigo = valor.strip().lower()
    if codigo not in PAISES_CON_BANDERA:
        raise ValueError(
            f"'{valor}' no es un pais reconocido. Se espera el codigo de dos "
            "letras, por ejemplo 'pa'."
        )
    return codigo

class PilotCreate(BaseModel):
    # Opcional: lo normal es que lo ponga el servicio. Se sigue aceptando
    # escrito para poder importar datos conservando su numeración.
    pilot_id: Optional[int] = None
    name: str
    last_name: str
    nationality: Optional[str] = None
    team_brand: Optional[str] = None # "Zentogo Racing"
    # El equipo de cada disciplina. Si llega vacio y viene team_brand, el
    # servicio lo reparte entre las disciplinas del alta.
    equipos: Dict[str, str] = {}
    photo: Optional[str] = None # ruta dentro de public/, ej "pilotos/prospec-series/1.png"
    category_ids: List[int] = [] # Recibimos IDs. En el service buscamos Category y hacemos Link
    discipline: List[str] = [] # ["circuito", "drag"]

    _valida_pais = field_validator("nationality")(_pais)

class PilotUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    nationality: Optional[str] = None
    team_brand: Optional[str] = None
    # Solo las disciplinas que se manden. Las demas se quedan como estan:
    # editando desde drag no se toca el equipo de circuito.
    equipos: Optional[Dict[str, str]] = None
    # Desde que disciplina se esta editando. No se guarda: sirve para
    # reemplazar solo sus categorias y dejar las de la otra en paz.
    disciplina_activa: Optional[str] = None
    photo: Optional[str] = None
    category_ids: Optional[List[int]] = None
    discipline: Optional[List[str]] = None

    # Se da de baja en vez de borrarlo: un piloto que dejó de correr sigue
    # apareciendo en los resultados de las tandas que ya se disputaron.
    is_active: Optional[bool] = None

    _valida_pais = field_validator("nationality")(_pais)

class AltaDisciplina(BaseModel):
    """Sumar a una persona ya registrada a otra disciplina.

    No se copia nada de lo que ya tenga: el equipo, las categorias y los
    carros son de cada campeonato. Lo unico que se reutiliza es quien es:
    nombre, nacionalidad y foto.
    """
    disciplina: str
    equipo: Optional[str] = None
    category_ids: List[int] = []


class PilotResponse(BaseModel):
    id: str = Field(alias="_id")
    pilot_id: int
    name: str
    last_name: str
    nationality: Optional[str] = None
    # El equipo de la disciplina por la que se pregunta; sin disciplina, el
    # de la suya cuando solo corre en una.
    team_brand: Optional[str] = None
    equipos: Dict[str, str] = {}
    photo: Optional[str] = None
    # La dirección de la foto con su versión: cambia al subir otra.
    photo_url: Optional[str] = None
    categories: List[int] = [] # Aquí devolvemos solo los category_id para no hacer fetch pesado
    discipline: List[str] = []
    is_active: bool

    class Config:
        populate_by_name = True