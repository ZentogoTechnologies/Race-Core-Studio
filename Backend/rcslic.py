"""Lee y verifica un archivo de licencia .rcslic.

El cliente ya no teclea una clave: el instalador le pide el archivo que
Zentogo le entregó. Dentro va la licencia entera —plan, duración, a quién
se vendió— firmada en Ed25519, así que el equipo puede comprobar por sí
solo que nadie la fabricó ni la retocó, sin preguntarle a nadie.

Eso resuelve de paso algo que estaba torcido. Antes la clave RCS1 era un
simple «sí o no», y la licencia de verdad había que EMITIRLA en el equipo
del cliente; firmar exige la clave privada de Zentogo, que no puede
viajar con el producto —quien la tenga se fabrica licencias perpetuas—,
así que en la práctica el software quedaba sin exigir licencia. Con el
.rcslic la firma ya viene puesta: la privada se queda en Zentogo y el
cliente recibe solo el resultado.

Estructura del archivo:

    {
      "formato":   "rcslic/1",
      "llave":     "zentogo-2026",     <- qué clave pública lo firmó
      "contenido": "{...}",            <- la licencia, como CADENA
      "firma":     "base64"            <- Ed25519 sobre esa cadena
    }

«contenido» es una cadena y no un objeto a propósito: lo que se firma son
sus bytes exactos. Si fuera un objeto habría que volver a serializarlo
para verificar, y dos serializadores que ordenen las claves distinto o
pongan otros espacios producen bytes distintos y la firma dejaría de
cuadrar sin que nada estuviera mal.

    ⚠ LO QUE FALTA. El llavero de abajo está VACÍO: la clave pública de
      «zentogo-2026» vive donde se emiten las licencias y hay que
      traerla. Sin ella no se puede verificar ninguna firma, y este
      módulo rechaza todo diciendo exactamente eso. Ver `LLAVERO`.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

EXTENSION = ".rcslic"

# Solo este formato de sobre. Un archivo que diga otra cosa se rechaza en
# vez de interpretarse a medias: si algún día cambia la estructura, un
# equipo viejo tiene que decir «no entiendo esta licencia» y no adivinar.
FORMATO_SOBRE = "rcslic/1"
FORMATO_CONTENIDO = 1

# ── El llavero ───────────────────────────────────────────────
#
# id de clave -> clave pública Ed25519 en PEM.
#
# Es un diccionario y no una constante suelta porque las claves rotan: al
# jubilar una se añade la nueva y las licencias ya emitidas con la
# anterior siguen verificando. El archivo dice en «llave» con cuál se
# firmó, así que no hay que probarlas todas.
#
# Aquí va SOLO la pública. La privada no entra en este repositorio ni
# viaja en el instalador bajo ninguna circunstancia.
LLAVERO: dict[str, str] = {
    # "zentogo-2026": "-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----",
}


class LicenciaInvalida(Exception):
    """El archivo no sirve. El mensaje es para que lo lea el cliente."""


@dataclass(frozen=True)
class Licencia:
    """Lo que el archivo dice, ya verificado."""

    codigo: str
    cliente: str
    cliente_tipo: str
    plan: str
    plan_nombre: str
    familia: str
    plus: bool
    emitida: date
    vence: date | None
    horas_demo: int | None
    check_in_dias: int | None
    equipo: str | None
    reemplaza_a: str | None
    servidor: str
    llave: str

    @property
    def es_demo(self) -> bool:
        """Demo es la que no tiene fecha de vencimiento sino horas de uso."""
        return self.vence is None and bool(self.horas_demo)

    @property
    def perpetua(self) -> bool:
        return self.vence is None and not self.horas_demo

    def resumen(self) -> dict:
        """Para enseñarlo y para registrarlo. Sin la firma: no aporta."""
        return {
            "codigo": self.codigo,
            "cliente": self.cliente,
            "plan": self.plan,
            "plan_nombre": self.plan_nombre,
            "familia": self.familia,
            "plus": self.plus,
            "emitida": self.emitida.isoformat(),
            "vence": self.vence.isoformat() if self.vence else None,
            "horas_demo": self.horas_demo,
            "check_in_dias": self.check_in_dias,
            "servidor": self.servidor,
            "llave": self.llave,
        }


# ── Lectura ──────────────────────────────────────────────────

def _fecha(valor, campo: str) -> date | None:
    if valor in (None, ""):
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        raise LicenciaInvalida(
            f"La licencia trae una fecha que no se entiende en «{campo}»: {valor!r}")


def _sobre(ruta: Path) -> dict:
    """El JSON de fuera, con los cuatro campos comprobados."""
    try:
        crudo = ruta.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise LicenciaInvalida(f"No existe el archivo {ruta}")
    except OSError as e:
        raise LicenciaInvalida(f"No se pudo leer {ruta.name}: {e.strerror or e}")

    try:
        sobre = json.loads(crudo)
    except json.JSONDecodeError:
        raise LicenciaInvalida(
            f"{ruta.name} no es un archivo de licencia: está dañado o no es el que corresponde.")

    if not isinstance(sobre, dict):
        raise LicenciaInvalida(f"{ruta.name} no tiene la estructura de una licencia.")

    if sobre.get("formato") != FORMATO_SOBRE:
        raise LicenciaInvalida(
            f"Formato de licencia desconocido: {sobre.get('formato')!r}. "
            f"Este programa entiende {FORMATO_SOBRE!r}; puede que la licencia "
            f"sea de una versión más nueva.")

    for campo in ("llave", "contenido", "firma"):
        if not isinstance(sobre.get(campo), str) or not sobre[campo]:
            raise LicenciaInvalida(f"La licencia está incompleta: falta «{campo}».")

    return sobre


def _comprobar_firma(sobre: dict, nombre: str) -> None:
    """Ed25519 sobre los bytes de «contenido». Lanza si no cuadra."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.serialization import load_pem_public_key

    publica_pem = LLAVERO.get(sobre["llave"])
    if not publica_pem:
        if not LLAVERO:
            raise LicenciaInvalida(
                "Esta copia del programa no lleva ninguna clave de verificación, "
                "así que no puede comprobar licencias. Es un fallo de empaquetado: "
                "avise a soporte.")
        raise LicenciaInvalida(
            f"La licencia está firmada con una clave que este programa no conoce "
            f"({sobre['llave']}). Suele significar que hace falta actualizar.")

    try:
        firma = base64.b64decode(sobre["firma"], validate=True)
    except (ValueError, TypeError):
        raise LicenciaInvalida(f"La firma de {nombre} está dañada.")

    try:
        publica = load_pem_public_key(publica_pem.encode("utf-8"))
    except (ValueError, TypeError) as e:
        raise LicenciaInvalida(
            f"La clave de verificación «{sobre['llave']}» está mal escrita "
            f"en el programa: {e}. Avise a soporte.")

    try:
        publica.verify(firma, sobre["contenido"].encode("utf-8"))
    except InvalidSignature:
        raise LicenciaInvalida(
            f"La firma de {nombre} no es válida: el archivo fue modificado "
            f"después de emitirse, o no lo emitió Zentogo.")


def leer(ruta: Path | str) -> Licencia:
    """La licencia del archivo, ya verificada. Lanza LicenciaInvalida.

    Se verifica la firma ANTES de mirar el contenido. Al revés, un archivo
    falso llegaría a decidir el plan y la duración por el camino.
    """
    ruta = Path(ruta)

    if ruta.suffix.lower() != EXTENSION:
        raise LicenciaInvalida(
            f"El archivo de licencia tiene que terminar en {EXTENSION} "
            f"(este es «{ruta.name}»).")

    sobre = _sobre(ruta)
    _comprobar_firma(sobre, ruta.name)

    try:
        datos = json.loads(sobre["contenido"])
    except json.JSONDecodeError:
        raise LicenciaInvalida(
            "La licencia está firmada pero su contenido no se entiende.")

    if datos.get("formato") != FORMATO_CONTENIDO:
        raise LicenciaInvalida(
            f"Contenido de licencia en versión {datos.get('formato')!r}, que este "
            f"programa no entiende. Puede que haga falta actualizar.")

    emitida = _fecha(datos.get("emitida"), "emitida")
    if emitida is None:
        raise LicenciaInvalida("La licencia no dice cuándo se emitió.")

    horas = datos.get("horas_demo")
    dias_check = datos.get("check_in_dias")

    return Licencia(
        codigo=str(datos.get("codigo") or ""),
        cliente=str(datos.get("cliente") or ""),
        cliente_tipo=str(datos.get("cliente_tipo") or ""),
        plan=str(datos.get("plan") or ""),
        plan_nombre=str(datos.get("plan_nombre") or datos.get("plan") or ""),
        familia=str(datos.get("familia") or ""),
        plus=bool(datos.get("plus")),
        emitida=emitida,
        vence=_fecha(datos.get("vence"), "vence"),
        horas_demo=int(horas) if horas else None,
        check_in_dias=int(dias_check) if dias_check else None,
        equipo=datos.get("equipo") or None,
        reemplaza_a=datos.get("reemplaza_a") or None,
        servidor=str(datos.get("servidor") or ""),
        llave=sobre["llave"],
    )


def hay_con_que_verificar() -> bool:
    """¿Lleva este programa alguna clave pública? Ver el aviso de arriba."""
    return bool(LLAVERO)
