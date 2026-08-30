"""
Lectura del current.xml que escribe MyLaps.

MyLaps reescribe el archivo constantemente, así que se lee bajo demanda y
se cachea un instante: varias plantillas pidiendo a la vez no deben
provocar una lectura de disco por cada una.

Los nombres del XML no sirven tal cual. MyLaps mete el nombre completo en
`firstname` y deja `lastname` vacío, y en los carros compartidos parte la
cadena por donde cae:

    firstname="ANDRII SADOVIAK /JUAN"  lastname="FELIPE RAMIREZ"

Por eso se cruza por número de carro contra la colección de vehículos, y
de ahí salen los nombres bien escritos, con acentos, de la base.
"""

import time
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

from config import settings
from src.services.graphics_services import brand_logo_url
from src.models.categories_model import Category
from src.models.pilots_model import Pilot
from src.models.vehicles_model import Vehicle


# ── Tipo de tanda ─────────────────────────────────────────────
# El runtype de MyLaps es una letra; el número sale del runname
# ("Heat 3" -> HEAT-3). Si el nombre no trae número, va solo la etiqueta.

TIPOS = {
    "R": "HEAT",
    "H": "HEAT",
    "Q": "QUALY",
    "P": "PRACTICE",
    "W": "PRACTICE",
}


def _titulo_tanda(runtype: str, runname: str) -> str:
    etiqueta = TIPOS.get((runtype or "").strip().upper())

    if etiqueta is None:
        # Tipo desconocido: se muestra el nombre tal cual lo puso MyLaps.
        return (runname or "").strip().upper()

    numero = "".join(c for c in (runname or "") if c.isdigit())
    return f"{etiqueta}-{numero}" if numero else etiqueta


def _iniciales(nombre: str, apellido: str) -> str:
    """'Ian Sebastián' + 'León' -> 'I. LEÓN'. Para el tótem de nombres."""
    inicial = nombre.strip()[:1].upper()
    apellido = apellido.strip().upper()
    if inicial and apellido:
        return f"{inicial}. {apellido}"
    return apellido or inicial


def _abreviado(nombre: str, apellido: str) -> str:
    """
    'Ian Sebastián' + 'León' -> 'I. LEÓ'. Para el tótem corto.

    Tres letras del apellido, que es el formato de la columna SHORT de
    las plantillas de pilotos.
    """
    inicial = nombre.strip()[:1].upper()
    corto = apellido.strip().upper()[:3]
    if inicial and corto:
        return f"{inicial}. {corto}"
    return corto or inicial


def _del_xml(fullname: str) -> tuple[str, str]:
    """
    Reparto de emergencia cuando el piloto no está en la base.

    Se toma la última palabra como apellido y la primera como nombre, que
    es lo que mejor funciona con el formato que manda MyLaps.

    En los carros compartidos MyLaps manda los dos pilotos separados por
    barra ("ENRIQUE NORIEGA / FERNANDO SEFERLIS"). Partiendo por espacios
    salía el nombre de uno con el apellido del otro: "E. SEFERLIS", una
    persona que no existe. Se toma solo el primero de la barra.
    """
    primero = (fullname or "").split("/")[0]
    partes = [p for p in primero.split() if p]
    if not partes:
        return "", ""
    if len(partes) == 1:
        return "", partes[0]
    return partes[0], partes[-1]


# ── Categoría: sin esto se cruzan los carros ──────────────────
# El dorsal se repite entre categorías (hay un #8 en GT Challenge, otro
# en Prospec y otro en Street Legal), así que buscar solo por número
# devuelve al piloto equivocado. MyLaps manda la categoría en `class`
# por fila y en `groupname` para toda la tanda.

def _normalizar(texto: str) -> str:
    """'5 - STREET LEGAL' -> 'street legal'. Sin prefijo, sin acentos."""
    t = unicodedata.normalize("NFD", (texto or "").strip().lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")

    # MyLaps antepone el número de grupo: "5 - STREET LEGAL"
    if " - " in t:
        cabeza, resto = t.split(" - ", 1)
        if cabeza.strip().isdigit():
            t = resto

    return " ".join(t.split())


def _sin_prefijo(texto: str) -> str:
    """'5 - STREET LEGAL' -> 'STREET LEGAL'."""
    t = (texto or "").strip()
    if " - " in t:
        cabeza, resto = t.split(" - ", 1)
        if cabeza.strip().isdigit():
            return resto.strip()
    return t


async def _buscar_vehiculo(dorsal: str, cat_id):
    """
    Cruza el dorsal de MyLaps contra la base.

    El dorsal se repite entre categorías (hay un #8 en GT Challenge, otro
    en Prospec y otro en Street Legal), así que sin categoría no se busca:
    sacar el nombre equivocado al aire es peor que usar el que manda MyLaps.

    Y dentro de la categoría el dorsal se compara tal cual viene, con sus
    ceros. '44' y '044' son dos carros distintos y como enteros son el
    mismo: por eso el #10 de Alejandro Torres salía como J. Nuñez, que en
    realidad corre el '010'. Se cae al entero solo cuando en la base no hay
    ningún otro carro que reclame ese dorsal escrito de otra forma.
    """
    dorsal = (dorsal or "").strip()
    if not dorsal or cat_id is None:
        return None

    exacto = await Vehicle.find_one(
        {"display_number": dorsal, "category_id": cat_id}
    )
    if exacto is not None:
        return exacto

    if not dorsal.isdigit():
        return None

    candidatos = await Vehicle.find(
        {"number": int(dorsal), "category_id": cat_id}
    ).to_list()

    # Si el candidato ya declaró otro dorsal, no es este carro.
    libres = [v for v in candidatos
              if not v.display_number or v.display_number == dorsal]
    return libres[0] if len(libres) == 1 else None


async def _mapa_categorias() -> dict[str, int]:
    return {
        _normalizar(c.category_name): c.category_id
        for c in await Category.find_all().to_list()
    }


def _resolver_categoria(texto: str, categorias: dict[str, int]):
    """
    Encuentra la categoria a la que se refiere MyLaps.

    No basta comparar textos: el mismo campeonato llega como 'TCR',
    'TCR PANAMA' o 'TCR - PANAMA' segun donde se mire. Se acepta que el
    nombre de la categoria sea el comienzo del texto, y entre varios
    candidatos gana el mas largo, para que 'gran turismo c' no se lo lleve
    'gran turismo'.
    """
    t = _normalizar(texto)
    if not t:
        return None

    if t in categorias:
        return categorias[t]

    mejor, largo = None, 0
    for nombre, cat_id in categorias.items():
        if not nombre:
            continue
        # Solo en frontera de palabra: 'tcr' vale para 'tcr panama',
        # pero no para 'tcrx'.
        if (t == nombre or t.startswith(nombre + " ")) and len(nombre) > largo:
            mejor, largo = cat_id, len(nombre)

    return mejor


# ── Control de la tanda ────────────────────────────────
# MyLaps dice cuánto dura la tanda, pero no la arranca ni la detiene: eso
# se maneja desde la botonera. El control vive aquí, en el backend, para
# que las cuatro plantillas vean exactamente lo mismo; si cada una contara
# por su cuenta se irían separando.
#
# Dos modos, porque no todas las tandas se miden igual:
#   tiempo  -> cuenta atrás desde una duración
#   vueltas -> contador que sube conforme avanza la carrera

_reloj: dict = {
    "modo": "tiempo",        # tiempo | vueltas
    "estado": "parado",      # parado | corriendo | pausado
    "restante": 0,           # segundos al pausar o arrancar
    "arrancado_en": 0.0,     # time.time() del último arranque
    "duracion": 0,           # a lo que vuelve al reiniciar
    "vuelta": 0,             # vuelta en curso
    "vueltas_total": 0,      # vueltas de la tanda
    "iniciado": False,       # ya se tomo la duracion inicial del XML
    "manual": False,         # el operador toco la botoneria
}


def _a_segundos(texto) -> int:
    """'15:00' -> 900. Acepta mm:ss, hh:mm:ss y segundos sueltos."""
    if texto is None:
        return 0
    if isinstance(texto, int):
        return max(0, texto)

    partes = [x for x in str(texto).strip().split(":") if x.strip().isdigit()]
    if not partes:
        return 0

    total = 0
    for x in partes:
        total = total * 60 + int(x)
    return total


def _formatear(segundos: int) -> str:
    """900 -> '15:00'. Nunca negativo: al llegar a cero se queda ahí."""
    segundos = max(0, int(segundos))
    horas, resto = divmod(segundos, 3600)
    minutos, seg = divmod(resto, 60)
    if horas:
        return "%d:%02d:%02d" % (horas, minutos, seg)
    return "%d:%02d" % (minutos, seg)


def _duracion_del_xml() -> int:
    try:
        return _a_segundos(leer_xml()["labels"].get("timetogo", ""))
    except Exception:
        return 0


def reloj_restante() -> int:
    """Segundos que quedan ahora mismo."""
    if _reloj["estado"] != "corriendo":
        return _reloj["restante"]
    transcurrido = time.time() - _reloj["arrancado_en"]
    return max(0, int(round(_reloj["restante"] - transcurrido)))


def reloj_estado() -> dict:
    # La primera vez se toma la duracion que diga MyLaps, para que el
    # panel arranque con algo util en vez de 0:00. Se lee una sola vez;
    # a partir de ahi manda lo que se escriba en la botonera.
    if (not _reloj["iniciado"] and _reloj["modo"] == "tiempo"
            and not _reloj["duracion"]):
        # Ojo: esto no activa el control manual. Es solo un valor de
        # partida para el panel; mientras no se toque un boton, el totem
        # sigue mostrando el reloj que manda MyLaps.
        _reloj["iniciado"] = True
        segundos = _duracion_del_xml()
        if segundos:
            _reloj["duracion"] = segundos
            _reloj["restante"] = segundos

    if _reloj["modo"] == "vueltas":
        total = _reloj["vueltas_total"]
        vuelta = _reloj["vuelta"]
        texto = ("%d / %d" % (vuelta, total)) if total else str(vuelta)
        return {
            "modo": "vueltas",
            "estado": _reloj["estado"],
            "etiqueta": "LAP",
        "manual": _reloj["manual"],
            "texto": texto,
            "vuelta": vuelta,
            "vueltas_total": total,
            "terminado": bool(total) and vuelta >= total,
        }

    restante = reloj_restante()
    return {
        "modo": "tiempo",
        "estado": _reloj["estado"],
        "etiqueta": "TIME",
        "manual": _reloj["manual"],
        "texto": _formatear(restante),
        "restante": restante,
        "duracion": _reloj["duracion"],
        "duracion_texto": _formatear(_reloj["duracion"]),
        "terminado": _reloj["estado"] == "corriendo" and restante == 0,
    }


def reloj_configurar(modo=None, duracion=None, vueltas_total=None) -> dict:
    """
    Ajusta el modo y los valores de la tanda.

    Cambiar la duración detiene el reloj: si se cambiara en marcha, el
    número saltaría en pantalla en mitad de la carrera.
    """
    if modo in ("tiempo", "vueltas"):
        _reloj["modo"] = modo
        _reloj["manual"] = True

    if duracion is not None:
        segundos = _a_segundos(duracion)
        _reloj["manual"] = True
        _reloj.update({
            "duracion": segundos,
            "restante": segundos,
            "estado": "parado",
            "arrancado_en": 0.0,
        })

    if vueltas_total is not None:
        _reloj["manual"] = True
        _reloj["vueltas_total"] = max(0, int(vueltas_total))
        if _reloj["vuelta"] > _reloj["vueltas_total"]:
            _reloj["vuelta"] = _reloj["vueltas_total"]

    return reloj_estado()


def reloj_arrancar(duracion=None) -> dict:
    """
    Pone en marcha la tanda.

    En modo tiempo: si estaba pausada sigue donde iba; si estaba parada
    arranca con la duración indicada, la ya configurada, o la del XML.
    En modo vueltas solo marca la tanda como en curso.
    """
    _reloj["manual"] = True

    if _reloj["modo"] == "vueltas":
        _reloj["estado"] = "corriendo"
        return reloj_estado()

    if _reloj["estado"] == "corriendo":
        return reloj_estado()

    if _reloj["estado"] == "parado" or _reloj["restante"] <= 0:
        segundos = _a_segundos(duracion) if duracion else 0
        segundos = segundos or _reloj["duracion"] or _duracion_del_xml()
        _reloj["restante"] = segundos
        _reloj["duracion"] = _reloj["duracion"] or segundos

    _reloj["arrancado_en"] = time.time()
    _reloj["estado"] = "corriendo"
    return reloj_estado()


def reloj_pausar() -> dict:
    if _reloj["modo"] == "tiempo" and _reloj["estado"] == "corriendo":
        _reloj["restante"] = reloj_restante()
    if _reloj["estado"] == "corriendo":
        _reloj["estado"] = "pausado"
    return reloj_estado()


def reloj_reiniciar(duracion=None) -> dict:
    """
    Vuelve al principio y se detiene.

    Sin duracion propia se devuelve el control a MyLaps: el totem vuelve a
    mostrar el reloj del XML hasta que se toque otro boton.
    """
    if duracion is None:
        _reloj["manual"] = False

    if _reloj["modo"] == "vueltas":
        _reloj.update({"estado": "parado", "vuelta": 0})
        return reloj_estado()

    segundos = _a_segundos(duracion) if duracion else 0
    segundos = segundos or _reloj["duracion"] or _duracion_del_xml()
    _reloj.update({
        "estado": "parado", "restante": segundos,
        "duracion": segundos, "arrancado_en": 0.0,
    })
    return reloj_estado()


def reloj_vuelta(delta: int = 1, absoluta=None) -> dict:
    """Suma o resta vueltas, o las fija de golpe."""
    _reloj["manual"] = True

    if absoluta is not None:
        _reloj["vuelta"] = max(0, int(absoluta))
    else:
        _reloj["vuelta"] = max(0, _reloj["vuelta"] + int(delta))

    total = _reloj["vueltas_total"]
    if total:
        _reloj["vuelta"] = min(_reloj["vuelta"], total)

    return reloj_estado()


# ── Lectura del archivo ───────────────────────────────────────

_cache: dict = {"momento": 0.0, "datos": None}


def leer_xml(ruta: str | None = None) -> dict:
    """
    Devuelve los labels y las filas crudas del current.xml.

    Lanza FileNotFoundError si no está el archivo y ET.ParseError si
    MyLaps lo pilló a medio escribir.
    """
    # La ruta efectiva sale de los ajustes, que pueden haberla cambiado
    # en caliente; el .env queda como valor por defecto.
    from src.services.settings_services import ruta_timing

    archivo = Path(ruta or ruta_timing())

    raiz = ET.parse(archivo).getroot()

    labels = {
        l.get("type"): (l.text or "").strip()
        for l in raiz.findall("label")
    }

    resultados = raiz.find("results")
    filas = resultados.findall("result") if resultados is not None else []

    return {"labels": labels, "filas": filas, "modificado": archivo.stat().st_mtime}


async def obtener_clasificacion(limite: int = 10, ruta: str | None = None) -> dict:
    """
    Clasificación lista para las plantillas, con los nombres de la base.

    `limite` recorta a los primeros N por posición, que es lo que cabe en
    el tótem.
    """
    ahora = time.time()
    cacheado = _cache["datos"]

    if cacheado and ahora - _cache["momento"] < settings.TIMING_CACHE_SECONDS:
        if cacheado["limite"] >= limite:
            # El reloj se recalcula siempre: la caché es para no releer el
            # archivo de red, no para congelar la cuenta atrás.
            reloj = reloj_estado()
            manual = _reloj["manual"]
            tiempo = (reloj["texto"] if manual
                      else cacheado["race_time"] or cacheado["time_to_go"])
            return {**cacheado,
                    "standings": cacheado["standings"][:limite],
                    "time": tiempo,
                    "time_label": reloj["etiqueta"],
                    "timer": reloj}

    crudo = leer_xml(ruta)
    labels = crudo["labels"]

    filas = sorted(
        crudo["filas"],
        key=lambda f: int(f.get("position") or 9999),
    )[:limite]

    categorias = await _mapa_categorias()
    cat_tanda = _resolver_categoria(labels.get("groupname", ""), categorias)

    standings = []
    for f in filas:
        numero = (f.get("no") or "").strip()

        nombre = apellido = ""
        pilot_id = None

        # Número + categoría: el dorsal solo no es único entre categorías.
        cat_id = _resolver_categoria(f.get("class", ""), categorias) or cat_tanda

        marca = None
        marca_logo = None

        vehiculo = await _buscar_vehiculo(numero, cat_id)
        if vehiculo is not None:
            # La marca alimenta el logo de cada fila del tótem. Se resuelve
            # aquí porque es donde ya se tiene el vehículo del dorsal; el
            # tótem no puede cruzarlo por su cuenta desde una plantilla.
            marca = vehiculo.brand
            marca_logo = brand_logo_url(vehiculo.brand) if vehiculo.brand else None

            await vehiculo.fetch_all_links()
            if vehiculo.pilots:
                # MyLaps no dice cuál de los dos va manejando: manda los dos
                # nombres pegados en el mismo campo. Manda el que se haya
                # elegido en el panel; si no hay elección, el primero.
                piloto = next(
                    (p for p in vehiculo.pilots
                     if p.pilot_id == vehiculo.active_pilot_id),
                    vehiculo.pilots[0],
                )
                nombre, apellido = piloto.name, piloto.last_name
                pilot_id = piloto.pilot_id

        if not apellido:
            nombre, apellido = _del_xml(f.get("fullname") or f.get("firstname") or "")

        standings.append({
            "position": int(f.get("position") or 0),
            "number": numero,
            "pilot_id": pilot_id,
            "name": nombre,
            "last_name": apellido,
            "short_name": _iniciales(nombre, apellido),
            "abbr_name": _abreviado(nombre, apellido),
            "full_name": " ".join(x for x in (nombre, apellido) if x).upper(),
            # difference = contra el líder, gap = contra el de adelante
            "leader": (f.get("difference") or "").strip(),
            "interval": (f.get("gap") or "").strip(),
            "laps": (f.get("laps") or "").strip(),
            "last_time": (f.get("lasttime") or "").strip(),
            "best_time": (f.get("besttime") or "").strip(),
            "brand": marca,
            "brand_logo": marca_logo,
        })

    # Antes de arrancar, MyLaps deja racetime vacío y pone la cuenta atrás
    # en timetogo. Se muestra lo que haya, para que el reloj del tótem no
    # aparezca en blanco durante el warmup.
    racetime = labels.get("racetime", "")
    timetogo = labels.get("timetogo", "")

    # La cuenta atrás manual manda sobre lo que diga el XML: si se arrancó
    # desde la botonera, el tótem muestra ese reloj.
    # El control manual manda en cuanto se toca: si se escribio una
    # duracion, esa es la que se ve aunque el reloj siga parado.
    reloj = reloj_estado()
    manual = _reloj["manual"]
    mostrar = reloj["texto"] if manual else (racetime or timetogo)

    datos = {
        "heat": _titulo_tanda(labels.get("runtype", ""), labels.get("runname", "")),
        "run_name": labels.get("runname", ""),
        "run_type": labels.get("runtype", ""),
        "event": labels.get("eventname", ""),
        "group": labels.get("groupname", ""),
        # MyLaps antepone el numero de grupo ("5 - STREET LEGAL"); para
        # pintarlo en el totem interesa solo el nombre.
        "group_name": _sin_prefijo(labels.get("groupname", "")),
        "time": mostrar,
        "time_label": reloj["etiqueta"],
        "timer": reloj,
        "race_time": racetime,
        "time_to_go": timetogo,
        # La tanda no ha empezado: hay cuenta atrás pero no reloj de carrera.
        "en_espera": not racetime and bool(timetogo),
        "time_of_day": labels.get("timeofday", ""),
        "laps": labels.get("laps", ""),
        "laps_to_go": labels.get("lapstogo", ""),
        "flag": labels.get("flag", ""),
        "track": labels.get("trackname", ""),
        "best_lap_by": labels.get("bestlapby", ""),
        "best_lap_time": labels.get("bestlaptime", ""),
        "standings": standings,
        "limite": limite,
    }

    _cache["datos"] = datos
    _cache["momento"] = ahora
    return datos


async def carros_en_pista(ruta: str | None = None) -> list[dict]:
    """
    Los carros que aparecen en el current.xml, con sus pilotos.

    Alimenta el panel donde se elige quién va manejando en los carros
    compartidos. Va aparte de la clasificación porque no depende del
    límite de posiciones del tótem: interesan todos los que corren.
    """
    crudo = leer_xml(ruta)
    labels = crudo["labels"]

    categorias = await _mapa_categorias()
    cat_tanda = _resolver_categoria(labels.get("groupname", ""), categorias)

    carros = []
    for f in sorted(crudo["filas"], key=lambda x: int(x.get("position") or 9999)):
        numero = (f.get("no") or "").strip()
        if not numero.isdigit():
            continue

        cat_id = _resolver_categoria(f.get("class", ""), categorias) or cat_tanda

        vehiculo = await _buscar_vehiculo(numero, cat_id)
        if vehiculo is None:
            carros.append({
                "number": numero,
                "position": int(f.get("position") or 0),
                "vehicle_id": None,
                "category_id": cat_id,
                "pilots": [],
                "active_pilot_id": None,
                "en_base": False,
            })
            continue

        await vehiculo.fetch_all_links()
        pilotos = [{
            "pilot_id": p.pilot_id,
            "name": f"{p.name} {p.last_name}".strip(),
        } for p in vehiculo.pilots]

        elegido = vehiculo.active_pilot_id
        if elegido is None and pilotos:
            elegido = pilotos[0]["pilot_id"]

        carros.append({
            "number": numero,
            "position": int(f.get("position") or 0),
            "vehicle_id": vehiculo.vehicle_id,
            "category_id": vehiculo.category_id,
            "pilots": pilotos,
            "active_pilot_id": elegido,
            "en_base": True,
        })

    return carros


async def elegir_piloto(vehicle_id: int, pilot_id: int) -> dict:
    """Fija qué piloto de un carro compartido se muestra en el tótem."""
    vehiculo = await Vehicle.find_one(Vehicle.vehicle_id == vehicle_id)
    if vehiculo is None:
        raise LookupError(f"No existe el vehículo {vehicle_id}")

    await vehiculo.fetch_all_links()
    if pilot_id not in [p.pilot_id for p in vehiculo.pilots]:
        raise ValueError(
            f"El piloto {pilot_id} no está asignado al vehículo {vehicle_id}"
        )

    vehiculo.active_pilot_id = pilot_id
    await vehiculo.save()

    # La clasificación cacheada lleva el nombre viejo: se descarta para que
    # el tótem muestre el cambio en la siguiente consulta.
    _cache["datos"] = None

    return {"vehicle_id": vehicle_id, "active_pilot_id": pilot_id}
