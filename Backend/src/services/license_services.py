"""Validación de la licencia.

Toda la autoridad sobre si el software puede operar vive aquí, en el
backend, y se resuelve **sin red**. La licencia es un JWT firmado con
Ed25519 por el servidor de Zentogo; el backend solo lleva la clave
pública, así que puede comprobar que un token es auténtico pero no puede
fabricar uno.

Por qué offline: el software se usa en autódromos, y en un autódromo la
red se cae. Un sistema que exigiera contactar al servidor en cada arranque
apagaría los gráficos de un cliente al día durante una transmisión en
vivo. Aquí la conexión hace falta para *instalar* y para *renovar*, nunca
para trabajar.

De ahí sale la regla que gobierna todo este módulo:

    Se bloquea por vencimiento comprobado, jamás por falta de conexión.

El vencimiento es un hecho que viaja firmado dentro del propio token y se
comprueba contra el reloj local. No saber si el cliente renovó no es
motivo para apagar nada: para eso está el periodo de gracia.

Estados posibles y qué significan para el usuario:

    DESARROLLO      No hay licencia y no se exige (equipo de trabajo).
    ACTIVA          Todo en orden.
    GRACIA          Venció, pero aún dentro del margen. Opera y avisa.
    EXPIRADA        Venció y se acabó el margen. Se bloquea.
    SIN_LICENCIA    Nunca se activó.
    INVALIDA        Firma que no cuadra, o archivo corrupto.
    OTRO_EQUIPO     Licencia legítima, pero de otra máquina.
    OTRO_PRODUCTO   Licencia legítima, pero de otro producto de Zentogo.
    AUN_NO_VIGENTE  Emitida con fecha de inicio futura.
    RELOJ_ALTERADO  El reloj del sistema retrocedió de forma sospechosa.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

import jwt

from config import ruta_del_backend, settings
from src.services.fingerprint_services import huella_equipo

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
#  CLAVE PÚBLICA
#
#  Va escrita en el código y NO en el .env a propósito. Si saliera de un
#  archivo de configuración, cualquiera podría sustituirla por una suya,
#  firmarse una licencia perpetua y saltarse todo esto. Escrita aquí,
#  cambiarla obliga a recompilar el backend.
#
#  La privada correspondiente vive únicamente en el servidor de licencias
#  de Zentogo y no aparece en este repositorio por ningún lado.
#
#  ⚠ LA QUE ESTÁ PUESTA AHORA ES DE DESARROLLO, no de producción.
#
#  La genera tools/licencias/licencia_de_prueba.py para poder probar el
#  sistema de extremo a extremo, y su privada está en claves-desarrollo/,
#  que no va a git. Antes de la primera venta hay que:
#
#      1. Generar el par real:
#         python tools/licencias/claves.py --nombre licencias
#      2. Guardar la privada solo en el servidor de licencias.
#      3. Pegar aquí la pública y recompilar el backend.
#
#  Mientras siga esta clave, el backend lo avisa al arrancar (ver
#  `es_clave_de_desarrollo`). Si eso sale en la consola de un cliente,
#  el paso 3 se saltó.
# ══════════════════════════════════════════════════════════════════════

CLAVE_PUBLICA_PEM = """-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAX/GCLCwa2z7cU/sX8Q6pd7CrkMkuz+1zpelsA5r3Lxw=
-----END PUBLIC KEY-----"""

# Ed25519. Se nombra el algoritmo explícitamente al verificar para que un
# token que llegue diciendo "alg": "none" no se acepte jamás.
ALGORITMO = "EdDSA"

EMISOR = "zentogo-licencias"

# Identificador de este producto. Cuando existan Race America o Race
# Motors, cada uno llevará el suyo y una licencia no servirá para otro.
PRODUCTO = "race-core-studio"


class Estado(str, Enum):
    DESARROLLO = "desarrollo"
    ACTIVA = "activa"
    GRACIA = "gracia"
    EXPIRADA = "expirada"
    SIN_LICENCIA = "sin_licencia"
    INVALIDA = "invalida"
    OTRO_EQUIPO = "otro_equipo"
    OTRO_PRODUCTO = "otro_producto"
    AUN_NO_VIGENTE = "aun_no_vigente"
    RELOJ_ALTERADO = "reloj_alterado"


# Los únicos estados con los que el software trabaja. Todo lo demás
# bloquea. Se declara como conjunto y no como una cadena de `if` para que
# la política se lea de un vistazo y no se pueda ampliar sin querer.
ESTADOS_QUE_OPERAN = {Estado.DESARROLLO, Estado.ACTIVA, Estado.GRACIA}


MENSAJES = {
    Estado.DESARROLLO: "Modo desarrollo: sin licencia instalada.",
    Estado.ACTIVA: "Licencia activa.",
    Estado.GRACIA: "La licencia venció. Renueva para no perder el servicio.",
    Estado.EXPIRADA: "La licencia expiró. Renueva para volver a operar.",
    Estado.SIN_LICENCIA: "No hay licencia instalada en este equipo.",
    Estado.INVALIDA: "La licencia no es válida o está dañada.",
    Estado.OTRO_EQUIPO: "Esta licencia pertenece a otro equipo.",
    Estado.OTRO_PRODUCTO: "Esta licencia es de otro producto de Zentogo.",
    Estado.AUN_NO_VIGENTE: "La licencia todavía no entra en vigencia.",
    Estado.RELOJ_ALTERADO: "El reloj del sistema no es confiable. Ajusta la fecha y hora.",
}


@dataclass
class Licencia:
    """El resultado de mirar la licencia: qué dice y qué se puede hacer."""

    estado: Estado
    mensaje: str = ""

    # Datos del token. Vacíos si no se pudo leer.
    licencia_id: Optional[str] = None
    cliente: Optional[str] = None
    correo: Optional[str] = None
    producto: Optional[str] = None
    plan: Optional[str] = None
    features: list[str] = field(default_factory=list)
    version_max: Optional[str] = None
    equipo: Optional[str] = None

    emitida: Optional[datetime] = None
    vence: Optional[datetime] = None
    gracia_dias: int = 0
    revalidar_dias: int = 0

    @property
    def opera(self) -> bool:
        return self.estado in ESTADOS_QUE_OPERAN

    @property
    def dias_restantes(self) -> Optional[int]:
        """Días hasta el vencimiento. Negativo si ya venció."""
        if self.vence is None:
            return None
        return (self.vence - _ahora()).days

    @property
    def fin_de_gracia(self) -> Optional[datetime]:
        if self.vence is None:
            return None
        return self.vence + timedelta(days=self.gracia_dias)

    @property
    def dias_de_gracia_restantes(self) -> Optional[int]:
        """Cuánto queda antes del bloqueo. Solo tiene sentido en GRACIA."""
        fin = self.fin_de_gracia
        if fin is None:
            return None
        return max(0, (fin - _ahora()).days)

    def resumen(self) -> dict:
        """Lo que se le enseña al panel. Sin el token ni la huella cruda."""
        return {
            "estado": self.estado.value,
            "opera": self.opera,
            "codigo": self.licencia_id,
            "mensaje": self.mensaje or MENSAJES.get(self.estado, ""),
            "cliente": self.cliente,
            "correo": self.correo,
            "producto": self.producto,
            "plan": self.plan,
            "features": self.features,
            "version_max": self.version_max,
            "vence": self.vence.isoformat() if self.vence else None,
            "dias_restantes": self.dias_restantes,
            "gracia_dias": self.gracia_dias,
            "dias_de_gracia_restantes": (
                self.dias_de_gracia_restantes if self.estado is Estado.GRACIA else None
            ),
        }


# Huella de la clave de desarrollo que instala licencia_de_prueba.py. Se
# compara para poder avisar; no es un secreto, es justo lo contrario.
_INICIO_CLAVE_DESARROLLO = "MCowBQYDK2VwAyEAX/GCLCwa2z7cU/sX8Q6pd7CrkMkuz+1zpelsA5r3Lxw="


def es_clave_de_desarrollo() -> bool:
    """¿El backend está verificando con la clave de pruebas?"""
    return _INICIO_CLAVE_DESARROLLO in CLAVE_PUBLICA_PEM


def avisar_si_es_de_desarrollo() -> None:
    """Se llama al arrancar. Ruidoso a propósito.

    Vender con esta clave significaría que cualquiera que haya tenido el
    repositorio delante puede emitirse licencias perpetuas. El aviso está
    para que eso no pase por descuido.
    """
    # Con .rcslic esa clave no verifica nada: el llavero está en rcslic.py.
    if es_clave_de_desarrollo() and not ruta_rcslic().exists():
        logger.warning(
            "LICENCIAS: clave pública DE DESARROLLO en uso. "
            "No distribuir así: generar el par de producción con "
            "tools/licencias/claves.py y sustituirla."
        )


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _sin_licencia(estado: Estado, mensaje: str = "") -> Licencia:
    return Licencia(estado=estado, mensaje=mensaje or MENSAJES.get(estado, ""))


# ── Dónde viven los archivos ─────────────────────────────────

def ruta_licencia() -> Path:
    """Archivo con el token. Lo escribe el instalador al activar."""
    return ruta_del_backend(settings.LICENSE_FILE)


def ruta_estado() -> Path:
    """Marca de agua del reloj. Ver `_revisar_reloj`."""
    return ruta_del_backend(settings.LICENSE_STATE_FILE)


# ── Reloj ────────────────────────────────────────────────────
#
# Atrasar la fecha del sistema es la forma más simple de estirar una
# licencia vencida. Contra eso se guarda la fecha más alta que se ha
# visto: si el reloj aparece por detrás de esa marca, algo se movió.
#
# La tolerancia es amplia a propósito. Un equipo que estuvo apagado y
# perdió la pila de la placa arranca con una fecha vieja sin que nadie
# haya hecho trampa, y castigar eso dejaría a un cliente honesto sin
# gráficos. Con margen de días, el error de buena fe pasa y el retroceso
# de meses —que es el que sirve para estirar una licencia— no.

def _revisar_reloj() -> bool:
    """True si el reloj es creíble. Actualiza la marca de agua."""
    archivo = ruta_estado()
    ahora = _ahora()
    visto = None

    try:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        visto = datetime.fromisoformat(datos["visto_max"])
    except (OSError, ValueError, KeyError, TypeError):
        # Sin marca previa no hay nada contra qué comparar. Puede ser la
        # primera vez, o que alguien la borrara; en ambos casos se vuelve
        # a empezar desde ahora en vez de bloquear.
        visto = None

    creible = True
    if visto is not None:
        if visto.tzinfo is None:
            visto = visto.replace(tzinfo=timezone.utc)
        if ahora < visto - timedelta(days=settings.LICENSE_CLOCK_TOLERANCE_DAYS):
            creible = False

    # La marca solo sube. Si el reloj está atrasado no se rebaja, porque
    # eso permitiría corregir la marca a base de arrancar con la fecha
    # cada vez un poco más atrás.
    tope = ahora if visto is None else max(ahora, visto)

    try:
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_text(
            json.dumps({"visto_max": tope.isoformat()}, indent=2),
            encoding="utf-8",
        )
    except OSError as e:
        # No poder escribir la marca no puede tumbar el arranque: sería
        # apagar el software por un permiso de carpeta.
        logger.warning("No se pudo guardar la marca de reloj: %s", e)

    return creible


# ── Verificación ─────────────────────────────────────────────

def verificar_token(
    token: str,
    huella: Optional[str] = None,
    clave_publica: Optional[str] = None,
) -> Licencia:
    """Comprueba firma, producto, equipo y fechas de un token.

    `huella` y `clave_publica` se pueden inyectar para las pruebas; en
    producción salen del equipo y de la constante de este módulo.
    """
    huella = huella or huella_equipo()
    clave = clave_publica or CLAVE_PUBLICA_PEM

    try:
        # Las comprobaciones de fecha de PyJWT se desactivan a propósito, y
        # es la decisión central de todo el módulo. Por defecto, PyJWT
        # rechaza un token vencido (exp) o todavía no vigente (nbf) y no
        # devuelve nada de su contenido. Con eso no habría forma de saber
        # si estamos dentro del periodo de gracia o fuera de él, ni de
        # decirle al cliente cuándo venció, a nombre de quién estaba, ni
        # desde cuándo será válida una licencia adelantada: solo se sabría
        # "no sirve", que es justo el mensaje inútil que hace llamar a
        # soporte. Las dos fechas se evalúan más abajo, a mano.
        #
        # Lo que sí sigue verificando PyJWT es lo que no se negocia: la
        # firma y el algoritmo. Un token con la firma mala nunca llega a
        # la parte de las fechas.
        datos = jwt.decode(
            token,
            clave,
            algorithms=[ALGORITMO],
            issuer=EMISOR,
            options={
                "verify_exp": False,
                "verify_nbf": False,
                "require": ["exp", "iat", "iss"],
            },
        )
    except jwt.InvalidIssuerError:
        return _sin_licencia(Estado.INVALIDA, "La licencia no fue emitida por Zentogo.")
    except jwt.InvalidTokenError as e:
        logger.warning("Licencia rechazada: %s", e)
        return _sin_licencia(Estado.INVALIDA)

    def fecha(clave_: str) -> Optional[datetime]:
        valor = datos.get(clave_)
        if valor is None:
            return None
        return datetime.fromtimestamp(valor, tz=timezone.utc)

    lic = Licencia(
        estado=Estado.INVALIDA,
        licencia_id=datos.get("jti"),
        cliente=datos.get("cliente"),
        correo=datos.get("correo"),
        producto=datos.get("producto"),
        plan=datos.get("plan"),
        features=list(datos.get("features") or []),
        version_max=datos.get("version_max"),
        equipo=datos.get("equipo"),
        emitida=fecha("iat"),
        vence=fecha("exp"),
        gracia_dias=int(datos.get("gracia_dias", 0)),
        revalidar_dias=int(datos.get("revalidar_dias", 0)),
    )

    # El orden importa: primero se descarta que la licencia sea de otro
    # sitio, y solo después se miran las fechas. Decirle a alguien "tu
    # licencia venció" cuando en realidad es la del equipo de al lado
    # manda a revisar el problema equivocado.
    if lic.producto != PRODUCTO:
        lic.estado = Estado.OTRO_PRODUCTO
        lic.mensaje = (
            f"Esta licencia es de «{lic.producto}» y este software es «{PRODUCTO}»."
        )
        return lic

    if lic.equipo != huella:
        lic.estado = Estado.OTRO_EQUIPO
        lic.mensaje = MENSAJES[Estado.OTRO_EQUIPO]
        return lic

    ahora = _ahora()

    inicio = fecha("nbf")
    if inicio is not None and ahora < inicio:
        lic.estado = Estado.AUN_NO_VIGENTE
        lic.mensaje = f"La licencia entra en vigencia el {inicio:%d/%m/%Y}."
        return lic

    if lic.vence is None:
        lic.estado = Estado.INVALIDA
        return lic

    if ahora < lic.vence:
        lic.estado = Estado.ACTIVA
        lic.mensaje = MENSAJES[Estado.ACTIVA]
    elif ahora < lic.vence + timedelta(days=lic.gracia_dias):
        lic.estado = Estado.GRACIA
        quedan = lic.dias_de_gracia_restantes
        lic.mensaje = (
            f"La licencia venció el {lic.vence:%d/%m/%Y}. "
            f"Quedan {quedan} día(s) antes de que el sistema se bloquee."
        )
    else:
        lic.estado = Estado.EXPIRADA
        lic.mensaje = f"La licencia expiró el {lic.vence:%d/%m/%Y}."

    return lic


# ── El .rcslic ───────────────────────────────────────────────
#
# Lo que el instalador deja desde la 1.1: el archivo que emitió
# rcs.zentogotech.com, copiado byte a byte, y al lado activacion.json con
# lo que contestó el servidor al activarlo en este equipo. El token JWT de
# arriba queda para los equipos que se instalaron con él.
#
# Las mismas reglas que con el token: se decide sin red, por la fecha
# firmada y el reloj local, y se bloquea por vencimiento comprobado,
# nunca por no poder hablar con el servidor.

# Días que sigue operando después de vencer, avisando. Lo decidido para
# el producto (ver installer/licencia_local.py).
GRACIA_DIAS = 7

ARCHIVO_RCSLIC = "licencia.rcslic"
ARCHIVO_ACTIVACION = "activacion.json"


def ruta_rcslic() -> Path:
    return ruta_del_backend(ARCHIVO_RCSLIC)


def ruta_activacion() -> Path:
    return ruta_del_backend(ARCHIVO_ACTIVACION)


def _activacion() -> dict:
    try:
        datos = json.loads(ruta_activacion().read_text(encoding="utf-8"))
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def guardar_activacion(datos: Optional[dict], huella: str) -> None:
    """Lo que dijo el servidor al activar, con la huella y la hora.

    La huella se guarda aunque el servidor no la devuelva: es contra lo
    que se compara en cada arranque, y lo que hace que copiar la carpeta
    de datos a otra máquina no se lleve la licencia con ella.
    """
    registro = dict(datos or {})
    registro["equipo"] = huella
    registro["activada_en"] = _ahora().isoformat()
    archivo = ruta_activacion()
    archivo.parent.mkdir(parents=True, exist_ok=True)
    archivo.write_text(json.dumps(registro, indent=2, ensure_ascii=False), encoding="utf-8")


def _fin_del_dia(dia) -> datetime:
    """«Vence el 8» es que el 8 todavía sirve: hasta su último instante,
    en hora local. No la medianoche del 9: el panel enseñaría el 9."""
    return datetime.combine(dia, datetime.max.time()).astimezone(timezone.utc)


def verificar_rcslic(ruta: Optional[Path] = None, huella: Optional[str] = None) -> Licencia:
    """Comprueba firma, activación en este equipo y fechas de un .rcslic."""
    import rcslic

    ruta = ruta or ruta_rcslic()
    huella = huella or huella_equipo()

    try:
        datos = rcslic.leer(ruta)
    except rcslic.LicenciaInvalida as e:
        logger.warning("Licencia .rcslic rechazada: %s", e)
        return _sin_licencia(Estado.INVALIDA, str(e))

    lic = Licencia(
        estado=Estado.INVALIDA,
        licencia_id=datos.codigo,
        cliente=datos.cliente,
        producto=PRODUCTO,
        plan=datos.plan_nombre or datos.plan,
        features=[f for f in (datos.familia, "plus" if datos.plus else "") if f],
        emitida=datetime.combine(datos.emitida, datetime.min.time()).astimezone(timezone.utc),
        gracia_dias=GRACIA_DIAS,
        revalidar_dias=datos.check_in_dias or 0,
        # Desde ya y no al final: aunque no opere aquí, el panel tiene que
        # poder decir hasta cuándo es la licencia que tiene delante.
        vence=_fin_del_dia(datos.vence) if datos.vence else None,
    )

    # Atada a un equipo desde la emisión (una reasignación, por ejemplo):
    # se respeta lo firmado antes que lo que diga el registro local.
    if datos.equipo and datos.equipo != huella:
        lic.estado = Estado.OTRO_EQUIPO
        lic.mensaje = MENSAJES[Estado.OTRO_EQUIPO]
        return lic

    # Sin activar no opera. El archivo solo dice qué se compró; que esté
    # en uso aquí y en ningún otro sitio lo dijo el servidor al activar.
    activ = _activacion()
    if activ.get("codigo") not in (None, datos.codigo) or not activ.get("equipo"):
        lic.estado = Estado.SIN_LICENCIA
        lic.mensaje = ("La licencia no está activada en este equipo. Actívela en "
                       "Ajustes → Licencia; hace falta conexión a internet.")
        return lic
    if activ["equipo"] != huella:
        lic.estado = Estado.OTRO_EQUIPO
        lic.mensaje = MENSAJES[Estado.OTRO_EQUIPO]
        return lic
    lic.equipo = huella

    ahora = _ahora()

    # Un día de margen: la fecha de emisión es la del servidor, en UTC, y
    # en América el reloj local puede ir todavía por el día anterior.
    if ahora < lic.emitida - timedelta(days=1):
        lic.estado = Estado.AUN_NO_VIGENTE
        lic.mensaje = f"La licencia entra en vigencia el {datos.emitida:%d/%m/%Y}."
        return lic

    if lic.vence is None and datos.horas_demo:
        # La demo cuenta desde que se activó, no desde que se emitió: se
        # vende hoy y se instala cuando el cliente pueda.
        try:
            inicio = datetime.fromisoformat(activ["activada_en"])
        except (KeyError, TypeError, ValueError):
            inicio = lic.emitida
        lic.vence = inicio + timedelta(hours=datos.horas_demo)
    elif lic.vence is None:
        lic.estado = Estado.ACTIVA
        lic.mensaje = "Licencia activa, sin fecha de vencimiento."
        return lic

    if ahora < lic.vence:
        lic.estado = Estado.ACTIVA
        lic.mensaje = MENSAJES[Estado.ACTIVA]
    elif ahora < lic.vence + timedelta(days=lic.gracia_dias):
        lic.estado = Estado.GRACIA
        lic.mensaje = (
            f"La licencia venció el {datos.vence or lic.vence.date():%d/%m/%Y}. "
            f"Quedan {lic.dias_de_gracia_restantes} día(s) antes de que los "
            f"gráficos se bloqueen."
        )
    else:
        lic.estado = Estado.EXPIRADA
        lic.mensaje = (
            f"La licencia expiró el {datos.vence or lic.vence.date():%d/%m/%Y}. "
            f"Cargue la renovación en Ajustes → Licencia."
        )
    return lic


class RenovacionFallida(Exception):
    """No se pudo instalar el .rcslic nuevo. El mensaje es para el cliente."""


def instalar_rcslic(contenido: bytes, nombre: str = "", version: Optional[str] = None) -> Licencia:
    """Instala un .rcslic nuevo desde el panel: la renovación.

    Se comprueba la firma, se activa contra el servidor y solo entonces
    se sustituye el archivo. En ese orden: si falta internet o el
    servidor dice que no, la licencia que había sigue intacta, y un
    cliente en plena gracia no se queda sin la que todavía le sirve.
    """
    import activacion
    import rcslic

    if len(contenido) > 64 * 1024:
        raise RenovacionFallida("Ese archivo es demasiado grande para ser una licencia.")

    destino = ruta_rcslic()
    destino.parent.mkdir(parents=True, exist_ok=True)
    # Con la extensión buena: rcslic.leer rechaza lo que no la lleve.
    temporal = destino.with_name("licencia-nueva" + rcslic.EXTENSION)
    temporal.write_bytes(contenido)

    try:
        try:
            datos = rcslic.leer(temporal)
            sobre = contenido.decode("utf-8")
        except rcslic.LicenciaInvalida as e:
            # Con el nombre que eligió el cliente, no el del temporal.
            raise RenovacionFallida(str(e).replace(temporal.name, nombre or "el archivo"))
        except UnicodeDecodeError:
            raise RenovacionFallida("Ese archivo no es una licencia de Race Core Studio.")

        huella = huella_equipo()
        r = activacion.activar(
            sobre_crudo=sobre,
            lic=datos,
            huella=huella,
            version=version or settings.APP_VERSION,
        )
        if not r.ok:
            raise RenovacionFallida(r.error)

        temporal.replace(destino)
        guardar_activacion(r.datos, huella)
    finally:
        try:
            temporal.unlink()
        except OSError:
            pass

    limpiar_cache()
    nueva = estado_licencia(refrescar=True)
    logger.info("Licencia renovada: %s, %s", datos.codigo, nueva.estado.value)
    return nueva


def leer_licencia() -> Licencia:
    """Lee el archivo de licencia del disco y lo evalúa. Sin caché."""
    if ruta_rcslic().exists():
        if not _revisar_reloj():
            return _sin_licencia(Estado.RELOJ_ALTERADO)
        return verificar_rcslic()

    if not settings.LICENSE_REQUIRED and not ruta_licencia().exists():
        # Equipo de trabajo: sin licencia y sin exigirla. Se avisa en el
        # log para que nadie confunda esto con una instalación de cliente.
        return _sin_licencia(Estado.DESARROLLO)

    try:
        token = ruta_licencia().read_text(encoding="utf-8").strip()
    except OSError:
        return _sin_licencia(Estado.SIN_LICENCIA)

    if not token:
        return _sin_licencia(Estado.SIN_LICENCIA)

    if not _revisar_reloj():
        return _sin_licencia(Estado.RELOJ_ALTERADO)

    return verificar_token(token)


# ── Caché ────────────────────────────────────────────────────
#
# El estado se consulta en cada petición protegida. Verificar una firma
# Ed25519 es barato, pero leer el archivo y el estado del reloj en cada
# llamada no lo es, y durante una transmisión las peticiones llegan
# seguidas. Se guarda un instante, lo bastante corto como para que el
# paso de ACTIVA a GRACIA o a EXPIRADA se note en el mismo minuto.

_cache: Optional[Licencia] = None
_cache_hasta: float = 0.0


def estado_licencia(refrescar: bool = False) -> Licencia:
    """El estado actual de la licencia, con caché de pocos segundos."""
    global _cache, _cache_hasta

    import time

    if refrescar or _cache is None or time.monotonic() >= _cache_hasta:
        _cache = leer_licencia()
        _cache_hasta = time.monotonic() + settings.LICENSE_CACHE_SECONDS

    return _cache


def limpiar_cache() -> None:
    """Olvida el estado guardado. Se llama al instalar una licencia nueva."""
    global _cache, _cache_hasta
    _cache = None
    _cache_hasta = 0.0


def guardar_licencia(token: str) -> Licencia:
    """Escribe el token en disco tras comprobar que sirve en este equipo.

    Se valida ANTES de escribir. Guardar primero y validar después dejaría
    una licencia inservible en el disco de un cliente que escribió mal la
    clave, y el siguiente arranque lo recibiría bloqueado en vez de con la
    pantalla de activación.
    """
    lic = verificar_token(token)

    if lic.estado not in (Estado.ACTIVA, Estado.GRACIA):
        return lic

    archivo = ruta_licencia()
    archivo.parent.mkdir(parents=True, exist_ok=True)
    archivo.write_text(token, encoding="utf-8")

    limpiar_cache()
    logger.info(
        "Licencia instalada: %s (%s), vence %s",
        lic.cliente, lic.correo, lic.vence,
    )
    return lic


# ── Guarda ───────────────────────────────────────────────────

async def licencia_vigente() -> Licencia:
    """Dependencia que exige licencia para operar.

    Se pone sobre lo que saca gráficos al aire, que es lo que de verdad se
    está vendiendo. Deliberadamente NO se pone sobre el login ni sobre la
    consulta de la propia licencia: un cliente con la licencia vencida
    tiene que poder entrar al panel para ver qué pasa y activar la
    renovación. Bloquearle también la puerta lo dejaría sin forma de
    arreglarlo desde el propio software.

    Devuelve 402 (Payment Required) y no 403. Es el código que existe
    justo para esto, y le permite al frontend distinguir «tu usuario no
    tiene permiso» de «hay que renovar» sin mirar el texto del mensaje.
    """
    from fastapi import HTTPException, status

    estado = estado_licencia()

    if not estado.opera:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=estado.mensaje or MENSAJES.get(estado.estado, "Licencia no válida."),
        )

    return estado
