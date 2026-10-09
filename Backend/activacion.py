"""Activa la licencia contra el servidor de Zentogo, al instalar.

Quien decide si esta instalación sigue adelante es el servidor, no el
equipo. El .rcslic dice qué se compró; el servidor dice si sigue vigente,
si ya se gastó en otra máquina, y ata esta licencia a ESTE equipo. Por eso
el instalador exige conexión: sin respuesta del servidor no se activa.

La firma del archivo se comprueba igualmente antes de llamar, cuando el
programa lleva la clave pública (ver rcslic.LLAVERO). No sustituye al
servidor: sirve para no gastar una llamada de red en un archivo que está
roto o retocado, y para dar un error claro sin depender de internet.

El otro lado es public/api/activar.php en rcs-licencias (el panel de
rcs.zentogotech.com). Contesta 200 con {"ok": true, …} si la activa, y
4xx con {"ok": false, "motivo": …, "mensaje": …} si no: el «mensaje» va
escrito para el cliente y es lo que se le enseña tal cual.
"""

from __future__ import annotations

import json
import platform
import urllib.error
import urllib.request
from dataclasses import dataclass

# La ruta de activación, relativa al «servidor» que trae la licencia.
RUTA_ACTIVAR = "api/activar.php"

PRODUCTO = "race-core-studio"

# Corto, pero no tanto que una conexión de autódromo falle sola. Son dos
# intentos: una red que tarda en despertar no debería costar una
# instalación.
ESPERA_SEGUNDOS = 20
INTENTOS = 2


@dataclass(frozen=True)
class Respuesta:
    """Lo que dijo el servidor, o por qué no se le pudo preguntar."""

    ok: bool
    error: str = ""
    sin_configurar: bool = False
    sin_red: bool = False
    datos: dict | None = None


def _cuerpo(sobre_crudo: str, lic, huella: str, version: str) -> bytes:
    """Lo que se le manda. Va el sobre ENTERO, no sus campos sueltos.

    Así el servidor puede comprobar la firma él mismo y no tiene que
    confiar en lo que este equipo le cuente del plan o del vencimiento:
    un cliente podría mandar «plan: platinum» y el servidor no tendría
    con qué desmentirlo.
    """
    return json.dumps({
        "producto": PRODUCTO,
        "version": version,
        "codigo": lic.codigo,
        "equipo": huella,
        # Solo para el registro de check-ins del panel: ayuda a reconocer
        # la máquina cuando la misma licencia llega desde dos sitios.
        "sistema": platform.platform(terse=True)[:80],
        "licencia": sobre_crudo,
    }, ensure_ascii=False).encode("utf-8")


def activar(sobre_crudo: str, lic, huella: str, version: str) -> Respuesta:
    """Pide al servidor que active esta licencia en este equipo."""
    if not RUTA_ACTIVAR:
        return Respuesta(
            ok=False, sin_configurar=True,
            error="Esta copia del programa no sabe cómo contactar con el "
                  "servidor de licencias. Es un fallo de empaquetado: "
                  "avise a soporte.")

    if not lic.servidor:
        return Respuesta(
            ok=False,
            error="La licencia no dice contra qué servidor activarse.")

    url = lic.servidor.rstrip("/") + "/" + RUTA_ACTIVAR.lstrip("/")
    peticion = urllib.request.Request(
        url,
        data=_cuerpo(sobre_crudo, lic, huella, version),
        headers={"Content-Type": "application/json",
                 "Accept": "application/json",
                 "User-Agent": f"{PRODUCTO}/{version}"},
        method="POST",
    )

    ultimo = ""
    for intento in range(1, INTENTOS + 1):
        try:
            with urllib.request.urlopen(peticion, timeout=ESPERA_SEGUNDOS) as r:
                crudo = r.read().decode("utf-8", errors="replace")
            break

        except urllib.error.HTTPError as e:
            # El servidor contestó, y dijo que no. Eso no se reintenta:
            # una licencia gastada no se desgasta menos al insistir.
            cuerpo = e.read().decode("utf-8", errors="replace")
            return Respuesta(ok=False, error=_motivo(cuerpo, e.code))

        except (urllib.error.URLError, OSError, TimeoutError) as e:
            ultimo = getattr(e, "reason", None) or str(e)
            if intento == INTENTOS:
                return Respuesta(
                    ok=False, sin_red=True,
                    error=f"No se pudo contactar con el servidor de licencias "
                          f"({lic.servidor}). La instalación necesita conexión "
                          f"a internet para activar. Detalle: {ultimo}")
    else:  # pragma: no cover - el for siempre sale por break o return
        return Respuesta(ok=False, sin_red=True, error=str(ultimo))

    try:
        datos = json.loads(crudo)
    except json.JSONDecodeError:
        return Respuesta(
            ok=False,
            error="El servidor de licencias contestó algo que no se entiende. "
                  "Vuelva a intentarlo; si sigue igual, avise a soporte.")

    if not isinstance(datos, dict) or not datos.get("ok"):
        return Respuesta(ok=False, error=_motivo(crudo, 200), datos=datos
                         if isinstance(datos, dict) else None)

    return Respuesta(ok=True, datos=datos)


def _motivo(crudo: str, codigo: int) -> str:
    """El «por qué no» del servidor, si lo dijo de forma legible."""
    try:
        datos = json.loads(crudo)
        if isinstance(datos, dict):
            for campo in ("mensaje", "error", "detail", "message"):
                if isinstance(datos.get(campo), str) and datos[campo].strip():
                    return datos[campo].strip()
    except json.JSONDecodeError:
        pass

    return f"El servidor de licencias rechazó la activación (código {codigo})."


def hay_con_que_activar() -> bool:
    return bool(RUTA_ACTIVAR)
