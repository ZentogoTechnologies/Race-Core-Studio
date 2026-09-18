import unicodedata
from typing import Optional

from beanie.operators import In
from src.models.pilots_model import Pilot
from pathlib import Path

from src.models.categories_model import Category
from src.services.imagenes_services import (
    con_version,    borrar_si_sobra, copiar_de_ruta, guardar_bytes, revisar_tamano,
)
from src.schemas.pilots_schemas import (
    AltaDisciplina, PilotCreate, PilotUpdate, PilotResponse,
)
from src.schemas.common_schemas import Page
from src.services.pagination import (
    campo_orden, combinar, direccion, filtro_busqueda,
)
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

# Backend/src/public/pilotos, mirando desde Backend/src/services. Las
# fotos subidas van a la raíz de pilotos/ y no a una subcarpeta de
# categoría: un piloto puede correr en varias, y el campo `photo` guarda
# la ruta exacta, así que no hace falta adivinarla después.
CARPETA_FOTOS = Path(__file__).resolve().parents[1] / "public" / "pilotos"

RUTA_RELATIVA = "pilotos"


DISCIPLINAS = ("circuito", "drag")


def _normalizar(texto: Optional[str]) -> str:
    """Para comparar nombres: sin tildes, sin mayusculas y sin dobles espacios.

    "José Pérez" y "jose perez" son la misma persona escrita por dos
    personas distintas, y el aviso de duplicado solo sirve si las ve
    iguales.
    """
    limpio = unicodedata.normalize("NFD", (texto or "").strip().lower())
    limpio = "".join(c for c in limpio if unicodedata.category(c) != "Mn")
    return " ".join(limpio.split())


def url_foto_piloto(photo):
    """La dirección con la que el panel pide la foto, con su versión."""
    if not photo:
        return None
    relativa = photo.lstrip("/")
    return con_version(f"/public/{relativa}", CARPETA_FOTOS.parent / relativa)


class PilotService:
    async def _build_response(self, pilot: Pilot,
                              disciplina: Optional[str] = None) -> PilotResponse:
        await pilot.fetch_all_links() # resuelve categories

        # Una categoria borrada deja el enlace sin resolver; se descarta en
        # vez de tumbar el listado entero.
        categorias = [c for c in (pilot.categories or [])
                      if hasattr(c, "category_id")]

        # Solo las de la disciplina por la que se pregunta: en drag no
        # pintan nada las categorias de circuito.
        if disciplina:
            categorias = [c for c in categorias if c.discipline == disciplina]

        categories_data = [c.category_id for c in categorias]

        equipos = pilot.equipos or {}
        # El equipo que se devuelve es el de la disciplina por la que se
        # pregunta. Sin disciplina —una ficha suelta— vale el suyo cuando
        # solo corre en una; si corre en las dos no hay uno solo que valga.
        if disciplina:
            equipo = equipos.get(disciplina)
        elif len(equipos) == 1:
            equipo = next(iter(equipos.values()))
        else:
            equipo = None

        return PilotResponse(
            id=str(pilot.id),
            photo_url=url_foto_piloto(pilot.photo),
            pilot_id=pilot.pilot_id,
            name=pilot.name,
            last_name=pilot.last_name,
            nationality=pilot.nationality,
            team_brand=equipo,
            equipos=equipos,
            photo=pilot.photo,
            categories=categories_data,
            discipline=pilot.discipline,
            is_active=pilot.is_active
        )

    async def _siguiente_id(self) -> int:
        """El id más alto que hay, más uno.

        Se calcula aquí y no en el navegador: si dos personas dan de alta
        un piloto a la vez, las dos verían el mismo número libre y la
        segunda chocaría al guardar.
        """
        ultimo = await Pilot.find_all().sort(("pilot_id", -1)).limit(1).to_list()
        return (ultimo[0].pilot_id + 1) if ultimo else 1

    async def create_pilot(self, data: PilotCreate) -> PilotResponse:
        # 1. El id lo pone el servicio salvo que venga escrito, que es el
        # caso de una importación que quiere conservar su numeración.
        if data.pilot_id is None:
            data.pilot_id = await self._siguiente_id()
        else:
            exists = await Pilot.find_one(Pilot.pilot_id == data.pilot_id)
            if exists:
                raise HTTPException(status_code=400, detail="pilot_id ya existe")

        # 2. Buscar las categories y convertirlas a Link
        categories_links = []
        if data.category_ids:
            categories = await Category.find(In(Category.category_id, data.category_ids)).to_list()
            if len(categories)!= len(data.category_ids):
                found_ids = [c.category_id for c in categories]
                missing = set(data.category_ids) - set(found_ids)
                raise HTTPException(status_code=404, detail=f"Categorías no encontradas: {missing}")
            categories_links = list(categories)  # Beanie los convierte a Link al guardar

        # El equipo se guarda por disciplina. Si el alta viene con el campo
        # viejo —una importacion, o el panel antiguo— se reparte entre las
        # disciplinas que traiga.
        equipos = dict(data.equipos or {})
        if data.team_brand and not equipos:
            equipos = {d: data.team_brand for d in (data.discipline or [])}

        pilot = Pilot(
            **data.model_dump(exclude={"category_ids", "equipos", "team_brand"}),
            equipos=equipos,
            categories=categories_links
        )
        await pilot.insert()
        return await self._build_response(pilot)

    # Campos por los que se deja ordenar. La lista es blanca a propósito:
    # sort_by llega del cliente y termina en el sort de Mongo.
    ORDENABLES = {"pilot_id", "name", "last_name", "nationality", "team_brand"}
    BUSCABLES = ["name", "last_name", "nationality"]

    async def get_all_pilots(
        self,
        discipline: Optional[str] = None,
        category_id: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_dir: Optional[str] = None,
        skip: int = 0,
        limit: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Page[PilotResponse]:
        # El equipo es de cada disciplina, asi que buscar y ordenar por el
        # solo tiene sentido dentro de una: `equipos.drag` es un campo mas
        # para Mongo. Sin disciplina se busca solo por persona.
        campo_equipo = f"equipos.{discipline}" if discipline else None
        buscables = self.BUSCABLES + ([campo_equipo] if campo_equipo else [])

        filtros = [
            {"discipline": discipline} if discipline else None,
            # None es "todos"; True o False filtran. Se distingue de False
            # a propósito: `if is_active` dejaría fuera a los inactivos.
            {"is_active": is_active} if is_active is not None else None,
            filtro_busqueda(search, buscables),
        ]

        # El filtro por categoría se resuelve contra el DBRef guardado, no
        # trayendo todos los pilotos y descartando en memoria: con eso la
        # paginación tendría que ocurrir después de leer la colección entera.
        if category_id:
            categoria = await Category.find_one(Category.category_id == int(category_id))
            if not categoria:
                return Page(items=[], total=0, skip=skip, limit=limit)
            filtros.append({"categories.$id": categoria.id})

        query = combinar(*filtros)

        total = await Pilot.find(query).count()

        orden = campo_orden(sort_by, self.ORDENABLES, "last_name")
        if orden == "team_brand":
            orden = campo_equipo or "last_name"

        consulta = Pilot.find(query).sort(
            (orden, direccion(sort_dir))
        ).skip(skip)

        # limit=None es "tráeme todo": lo usa el panel de gráficos, que
        # necesita la lista completa para el selector de pilotos.
        if limit is not None:
            consulta = consulta.limit(limit)

        pilots = await consulta.to_list()

        return Page(
            items=[await self._build_response(p, discipline) for p in pilots],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def get_pilot_by_id(self, pilot_id: str) -> PilotResponse: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int porque en DB es int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")
        return await self._build_response(pilot)

    async def update_pilot(self, pilot_id: str, data: PilotUpdate) -> PilotResponse: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        update_data = data.model_dump(exclude_unset=True) # <- model_dump

        # La disciplina desde la que se edita. No se guarda: dice cual de
        # las dos mitades de la ficha viene en esta peticion.
        activa = update_data.pop("disciplina_activa", None)

        # Si vienen category_ids nuevos, los convertimos a Link
        if "category_ids" in update_data:
            categories = await Category.find(In(Category.category_id, update_data["category_ids"])).to_list()
            if len(categories)!= len(update_data["category_ids"]):
                found_ids = [c.category_id for c in categories]
                missing = set(update_data["category_ids"]) - set(found_ids)
                raise HTTPException(status_code=404, detail=f"Categorías no encontradas: {missing}")

            nuevas = list(categories)
            if activa:
                # El formulario solo ensena las de la disciplina abierta, asi
                # que solo esas se reemplazan. Sin esto, guardar desde drag
                # borraba las categorias de circuito del mismo piloto.
                await pilot.fetch_all_links()
                nuevas = [c for c in (pilot.categories or [])
                          if hasattr(c, "category_id") and c.discipline != activa] + nuevas

            update_data["categories"] = nuevas  # Beanie los convierte a Link
            del update_data["category_ids"]

        # Los equipos se mezclan: el panel manda solo el de la disciplina
        # abierta y el de la otra se queda como estaba.
        if update_data.get("equipos") is not None:
            mezcla = dict(pilot.equipos or {})
            for disciplina, equipo in update_data.pop("equipos").items():
                if equipo:
                    mezcla[disciplina] = equipo
                else:
                    mezcla.pop(disciplina, None)
            update_data["equipos"] = mezcla

        for campo, valor in update_data.items():
            setattr(pilot, campo, valor)

        # save() y no update({"$set": ...}): solo al guardar el documento
        # Beanie convierte los Document en Link. Con $set se incrustaba el
        # documento completo y la relacion se perdia.
        await pilot.save()
        return await self._build_response(pilot)

    async def delete_pilot(self, pilot_id: str) -> dict: # <- str
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id)) # <- int
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        # La foto se va con el piloto. Si no, cada alta y baja deja un
        # archivo suelto en public/pilotos que nadie vuelve a mirar, y el
        # siguiente piloto que reciba ese id heredaría la cara del anterior.
        foto = (CARPETA_FOTOS.parent / pilot.photo.lstrip("/")) if pilot.photo else None

        # El piloto sale antes de los carros que manejaba. Si no, el
        # vehiculo se queda apuntando a algo que ya no existe y el
        # listado de su disciplina se caia entero con Error 500.
        from src.models.vehicles_model import Vehicle

        await Vehicle.find({"pilots.$id": pilot.id}).update(
            {"$pull": {"pilots": {"$id": pilot.id}}}
        )
        # Y deja de ser el que sale al aire en los carros compartidos.
        await Vehicle.find({"active_pilot_id": pilot.pilot_id}).update(
            {"$set": {"active_pilot_id": None}}
        )

        await pilot.delete()

        borrar_si_sobra(foto, CARPETA_FOTOS / "__ninguno__")

        return {"detail": "Piloto eliminado"}

    # ── La misma persona en varias disciplinas ────────────────────────

    async def buscar_persona(self, name: str, last_name: str) -> list[PilotResponse]:
        """Quien ya esta registrado con ese nombre, en la disciplina que sea.

        Es la unica consulta que cruza disciplinas a proposito: sirve para
        avisar de que esa persona ya existe antes de crear una ficha
        repetida. Devuelve la persona, no su temporada: lo que se ensena
        es el nombre, la foto y en que corre.
        """
        buscado = (_normalizar(name), _normalizar(last_name))
        if not buscado[0] and not buscado[1]:
            return []

        # Son unos cientos y la comparacion va sin tildes, que Mongo no sabe
        # hacer sin un indice de intercalacion: se filtra aqui.
        todos = await Pilot.find_all().to_list()
        iguales = [p for p in todos
                   if (_normalizar(p.name), _normalizar(p.last_name)) == buscado]

        return [await self._build_response(p) for p in iguales]

    async def agregar_disciplina(self, pilot_id: str,
                                 datos: AltaDisciplina) -> PilotResponse:
        """Suma a una persona ya registrada a otra disciplina.

        Se le anade la disciplina, su equipo y sus categorias de alli. No
        se toca nada de lo que tenga en la otra: el equipo, las categorias
        y los carros son de cada campeonato.
        """
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id))
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        disciplina = (datos.disciplina or "").strip().lower()
        if disciplina not in DISCIPLINAS:
            raise HTTPException(
                status_code=400,
                detail=f"'{datos.disciplina}' no es una disciplina",
            )

        categorias = []
        if datos.category_ids:
            categorias = await Category.find(
                In(Category.category_id, datos.category_ids)
            ).to_list()
            if len(categorias) != len(datos.category_ids):
                faltan = set(datos.category_ids) - {c.category_id for c in categorias}
                raise HTTPException(
                    status_code=404, detail=f"Categorías no encontradas: {faltan}"
                )
            ajenas = [c.category_name for c in categorias if c.discipline != disciplina]
            if ajenas:
                raise HTTPException(
                    status_code=400,
                    detail=f"{ajenas} no son categorías de {disciplina}",
                )

        await pilot.fetch_all_links()
        ya = {c.category_id for c in (pilot.categories or [])
              if hasattr(c, "category_id")}

        pilot.discipline = sorted(set(pilot.discipline or []) | {disciplina})
        equipos = dict(pilot.equipos or {})
        if datos.equipo:
            equipos[disciplina] = datos.equipo
        pilot.equipos = equipos
        pilot.categories = [c for c in (pilot.categories or [])
                            if hasattr(c, "category_id")] + \
                           [c for c in categorias if c.category_id not in ya]

        await pilot.save()
        return await self._build_response(pilot, disciplina)

    async def quitar_disciplina(self, pilot_id: str, disciplina: str) -> PilotResponse:
        """Deja de correr en esa disciplina, sin borrar a la persona.

        Borrar desde drag a alguien que tambien corre en circuito se
        llevaria por delante su ficha y su historial de alli. Esto quita
        solo lo de esta: la disciplina, su equipo, sus categorias y sus
        carros.
        """
        from src.models.vehicles_model import Vehicle

        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id))
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        disciplina = (disciplina or "").strip().lower()
        suyas = list(pilot.discipline or [])
        if disciplina not in suyas:
            raise HTTPException(
                status_code=400,
                detail=f"El piloto no corre en {disciplina}",
            )
        if len(suyas) == 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Es la única disciplina del piloto: para darlo de baja hay "
                    "que eliminarlo"
                ),
            )

        await pilot.fetch_all_links()
        quedan = []
        salen = []
        for c in (pilot.categories or []):
            if not hasattr(c, "category_id"):
                continue
            (salen if c.discipline == disciplina else quedan).append(c)

        # Sus carros de esa disciplina dejan de tenerlo. Un carro es de la
        # disciplina de su categoria.
        if salen:
            ids = [c.category_id for c in salen]
            await Vehicle.find(
                {"pilots.$id": pilot.id, "category_id": {"$in": ids}}
            ).update({"$pull": {"pilots": {"$id": pilot.id}}})
            await Vehicle.find(
                {"active_pilot_id": pilot.pilot_id, "category_id": {"$in": ids}}
            ).update({"$set": {"active_pilot_id": None}})

        pilot.discipline = [d for d in suyas if d != disciplina]
        equipos = dict(pilot.equipos or {})
        equipos.pop(disciplina, None)
        pilot.equipos = equipos
        pilot.categories = quedan

        await pilot.save()
        return await self._build_response(pilot)

    # ── Foto ──────────────────────────────────────────────────────────

    def _destino_foto(self, pilot_id: int) -> Path:
        """El fichero se llama como el id.

        Con el nombre del piloto habría que renombrarlo al corregir una
        tilde, y el id no cambia nunca. Además es lo que ya busca
        pilot_photo_url cuando el campo `photo` viene vacío.
        """
        return CARPETA_FOTOS / str(pilot_id)

    async def _guardar_foto(self, pilot_id: int, destino: Path) -> PilotResponse:
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id))
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        anterior = (CARPETA_FOTOS.parent / pilot.photo.lstrip("/")
                    if pilot.photo else None)

        pilot.photo = f"{RUTA_RELATIVA}/{destino.name}"
        await pilot.save()

        borrar_si_sobra(anterior, destino)

        return await self._build_response(pilot)

    async def subir_foto(self, pilot_id: str, nombre: str, contenido: bytes) -> PilotResponse:
        """La que llega desde el navegador."""
        pid = int(pilot_id)

        pilot = await Pilot.find_one(Pilot.pilot_id == pid)
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        destino = guardar_bytes(contenido, nombre, self._destino_foto(pid))
        return await self._guardar_foto(pid, destino)

    async def foto_por_ruta(self, pilot_id: str, ruta: str) -> PilotResponse:
        """La que ya está en el disco del servidor, escrita a mano."""
        pid = int(pilot_id)

        pilot = await Pilot.find_one(Pilot.pilot_id == pid)
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        destino = copiar_de_ruta(ruta, self._destino_foto(pid))
        return await self._guardar_foto(pid, destino)

    async def quitar_fondo(self, pilot_id: str) -> PilotResponse:
        """Recorta al piloto de su fondo y reemplaza la foto.

        Trabaja sobre la que ya está guardada en vez de pedir el archivo
        otra vez: así vale igual para una foto recién tomada con el iPad y
        para una que llevaba meses puesta, y no hay que volver a subir
        nada por una red del autódromo.

        El resultado siempre es PNG: el recorte necesita transparencia y
        un JPG no la tiene.
        """
        pid = int(pilot_id)

        pilot = await Pilot.find_one(Pilot.pilot_id == pid)
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        actual = (CARPETA_FOTOS.parent / pilot.photo.lstrip("/")
                  if pilot.photo else None)

        if actual is None or not actual.is_file():
            raise HTTPException(
                status_code=400,
                detail="El piloto no tiene foto: sube una antes de quitarle el fondo",
            )

        try:
            # El import va dentro: si faltara algo para recortar, que se
            # diga en claro y no como un 500 sin explicación.
            from src.services.recorte_services import quitar_fondo as recortar

            # En un hilo aparte: el primer recorte carga el modelo y tarda
            # unos segundos, y mientras tanto el resto del backend —el
            # cronometraje que está al aire— tiene que seguir contestando.
            recortada = await run_in_threadpool(recortar, actual.read_bytes())
        except Exception as e:
            # El modelo puede fallar con un archivo que no sea una imagen
            # de verdad. Se responde en claro en vez de dejar un 500 seco.
            raise HTTPException(
                status_code=422,
                detail=f"No se pudo quitar el fondo: {e}",
            )

        destino = guardar_bytes(recortada, "foto.png", self._destino_foto(pid))
        return await self._guardar_foto(pid, destino)

    async def recortar_subida(self, contenido: bytes) -> bytes:
        """Quita el fondo a una foto que todavía no está guardada.

        No toca ningún piloto ni escribe nada en disco: devuelve el PNG
        recortado y el panel decide si lo guarda. Es lo que permite
        recortar al dar de alta, cuando el piloto todavía no existe.
        """
        if not contenido:
            raise HTTPException(status_code=400, detail="El archivo llegó vacío")

        revisar_tamano(len(contenido))

        try:
            from src.services.recorte_services import quitar_fondo as recortar

            return await run_in_threadpool(recortar, contenido)
        except Exception as e:
            if type(e).__name__ == "UnidentifiedImageError":
                motivo = "el archivo no es una imagen que se pueda leer"
            else:
                motivo = str(e)
            raise HTTPException(
                status_code=422,
                detail=f"No se pudo quitar el fondo: {motivo}",
            )

    async def borrar_foto(self, pilot_id: str) -> PilotResponse:
        pilot = await Pilot.find_one(Pilot.pilot_id == int(pilot_id))
        if not pilot:
            raise HTTPException(status_code=404, detail="Piloto no encontrado")

        if pilot.photo:
            fichero = CARPETA_FOTOS.parent / pilot.photo.lstrip("/")
            pilot.photo = None
            await pilot.save()

            # Se pasa un destino que no existe para que siempre borre.
            borrar_si_sobra(fichero, CARPETA_FOTOS / "__ninguno__")

        return await self._build_response(pilot)


async def migrar_equipos() -> int:
    """El equipo suelto pasa a ser el equipo de su disciplina.

    Antes el piloto tenia un solo equipo porque pertenecia a una sola
    disciplina. Al poder correr en las dos, el equipo es de cada una: se
    copia el que tenia a las disciplinas en las que ya estaba y se vacia
    el campo viejo, para que no queden dos sitios diciendo lo mismo.
    """
    pendientes = await Pilot.find({"team_brand": {"$nin": [None, ""]}}).to_list()

    hechos = 0
    for piloto in pendientes:
        if not piloto.equipos:
            piloto.equipos = {d: piloto.team_brand for d in (piloto.discipline or [])}
        piloto.team_brand = None
        await piloto.save()
        hechos += 1

    return hechos
