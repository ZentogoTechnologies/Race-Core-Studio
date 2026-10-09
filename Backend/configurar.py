"""Deja el sistema listo para el primer arranque.

Es lo que hacía installer/instalar.py cuando el instalador clonaba el
repositorio y compilaba en el equipo del cliente. Ahora vive aquí, dentro
del backend congelado, porque es el único que lleva encima lo que hace
falta: el validador de licencias, el emisor y la huella del equipo.

    race-core-backend.exe --configurar --licencia …\licencia.rcslic

Hace cinco cosas, en este orden, y se para en la primera que falle:

    1. Lee el .rcslic y comprueba su firma, si este equipo puede.
    2. Lo activa contra el servidor de Zentogo. Quien decide es él.
    3. Guarda el archivo en la carpeta de datos, para releerlo en cada
       arranque.
    4. Escribe el .env, con una firma de sesiones distinta en cada
       instalación.
    5. Genera el token del asistente web.

El paso 2 es el que manda, y necesita internet. El archivo dice qué se
compró; el servidor dice si sigue vigente y si no se gastó ya en otra
máquina, y lo ata a este equipo.

Aquí no se emite ninguna licencia. Antes sí —la clave RCS1 era un simple
sí o no y la licencia había que fabricarla en el equipo del cliente—, y
eso exigía la clave privada de Zentogo, que no puede viajar con el
producto. Ver Backend/rcslic.py y Backend/activacion.py.

Se puede repetir sin miedo: renovar una licencia es volver a ejecutarlo.
Lo que ya existe y sigue valiendo, se respeta.
"""

import json
import secrets
from pathlib import Path
from typing import TYPE_CHECKING

import rutas

# Solo para la anotación de comprobar_licencia. En ejecución rcslic se
# importa dentro de cada función, y sin esto pyflakes ve un nombre
# indefinido y CI se niega a publicar.
if TYPE_CHECKING:
    import rcslic


def _decir(texto: str = "") -> None:
    print(texto, flush=True)


# ─── 1 · La licencia ─────────────────────────────────────────

def comprobar_licencia(ruta: str) -> "rcslic.Licencia | None":
    """Lee el archivo y comprueba su firma, si se puede comprobar aquí.

    Esto NO decide si se instala: eso lo dice el servidor. Sirve para no
    gastar una llamada de red en un archivo roto o retocado, y para dar
    un error claro antes de depender de internet.

    Cuando el programa no lleva clave pública, se lee sin verificar la
    firma y se sigue: el servidor la comprobará él, que es quien manda.
    """
    import rcslic

    try:
        lic = rcslic.leer(ruta, exigir_firma=rcslic.hay_con_que_verificar())
    except rcslic.LicenciaInvalida as e:
        _decir(f"LICENCIA: {e}")
        return None

    if not rcslic.hay_con_que_verificar():
        _decir("  (la firma la comprobará el servidor: este equipo no "
               "lleva clave pública)")

    _decir(f"Licencia {lic.codigo} · {lic.cliente} · plan {lic.plan_nombre}")
    if lic.es_demo:
        _decir(f"  Demostración: {lic.horas_demo} horas de uso.")
    elif lic.vence:
        _decir(f"  Vence el {lic.vence.isoformat()}.")
    else:
        _decir("  Sin fecha de vencimiento.")
    return lic


def guardar_licencia(origen: str) -> None:
    """Copia el .rcslic a la carpeta de datos, tal cual.

    Byte por byte y no reescrito: lo que se verifica son los bytes
    exactos del archivo, así que volver a serializarlo —otro orden de
    claves, otros espacios— invalidaría la firma sin que nada estuviera
    mal. Se copia donde el backend pueda releerlo en cada arranque, y
    donde sobreviva a actualizar y a reinstalar.
    """
    destino = rutas.DATOS / f"licencia{__import__('rcslic').EXTENSION}"
    destino.write_bytes(Path(origen).read_bytes())
    _decir(f"Licencia guardada en {destino}")


# ─── 2 · La activación ──────────────────────────────────────

def activar_en_el_servidor(ruta: str, lic) -> bool:
    """Pide al servidor que ate esta licencia a este equipo.

    Es quien decide. El archivo dice qué se compró; el servidor dice si
    sigue vigente y si no se gastó ya en otra máquina. Sin su sí, la
    instalación no se da por buena.
    """
    import activacion
    from config import settings
    from src.services.fingerprint_services import huella_equipo

    huella = huella_equipo()
    _decir(f"Equipo: {huella[:24]}…")
    _decir(f"Activando contra {lic.servidor} …")

    r = activacion.activar(
        sobre_crudo=Path(ruta).read_text(encoding="utf-8"),
        lic=lic,
        huella=huella,
        version=settings.APP_VERSION,
    )

    if r.ok:
        _decir("Licencia activada en este equipo.")
        if r.datos:
            (rutas.DATOS / "activacion.json").write_text(
                json.dumps(r.datos, indent=2, ensure_ascii=False),
                encoding="utf-8")
        return True

    _decir(f"ACTIVACIÓN: {r.error}")
    return False


# ─── 3 · La configuración ────────────────────────────────────

def escribir_env(exigir_licencia: bool, idioma: str = "") -> None:
    """El .env, conservando lo que ya hubiera.

    La firma de sesiones se genera una vez y no se vuelve a tocar:
    cambiarla al reinstalar echaría fuera a todo el mundo, incluida la
    sesión desde la que se esté trabajando.
    """
    archivo = rutas.DATOS / ".env"

    previos = {}
    if archivo.is_file():
        for linea in archivo.read_text(encoding="utf-8").splitlines():
            if "=" in linea and not linea.lstrip().startswith("#"):
                clave, _, valor = linea.partition("=")
                previos[clave.strip()] = valor.strip()

    valores = {
        "SECRET_KEY": previos.get("SECRET_KEY") or secrets.token_urlsafe(48),
        "MONGO_URI": previos.get("MONGO_URI", "mongodb://localhost:27017"),
        "DB_NAME": previos.get("DB_NAME", "race-core-studio"),
        "API_HOST": previos.get("API_HOST", "0.0.0.0"),
        "API_PORT": previos.get("API_PORT", "8080"),
        "LICENSE_REQUIRED": "true" if exigir_licencia else "false",
    }

    # El idioma solo se pone si el instalador lo mandó y aún no había uno.
    # Reinstalar no debe deshacer lo que alguien haya elegido después en
    # Ajustes: a partir del primer arranque manda la base, y el backend
    # reescribe esta línea con lo que allí esté guardado.
    idioma = (idioma or "").strip().lower()
    if idioma in ("es", "en"):
        valores["IDIOMA"] = previos.get("IDIOMA") or idioma
    elif previos.get("IDIOMA"):
        valores["IDIOMA"] = previos["IDIOMA"]

    archivo.write_text(
        "# Race Core Studio — escrito por el instalador.\n"
        "# SECRET_KEY firma las sesiones: si cambia, todos vuelven a entrar.\n\n"
        + "".join(f"{c}={v}\n" for c, v in valores.items()),
        encoding="utf-8",
    )
    _decir(f"Configuración en {archivo}")
    if previos.get("SECRET_KEY"):
        _decir("Se conserva la firma de sesiones que ya había.")


# ─── 4 · El asistente ────────────────────────────────────────

def token_del_asistente() -> str:
    from src.services.instalacion_services import crear_token

    token = crear_token()
    _decir(f"Asistente: http://127.0.0.1:8080/instalacion?token={token}")
    return token


# ─── Principal ───────────────────────────────────────────────

def configurar(licencia: str, idioma: str = "") -> int:
    _decir(f"Race Core Studio · configurando en {rutas.DATOS}")
    rutas.preparar()

    lic = comprobar_licencia(licencia)
    if lic is None:
        return 1

    if not activar_en_el_servidor(licencia, lic):
        return 1

    guardar_licencia(licencia)

    # LICENSE_REQUIRED se queda en falso a propósito, y no es un olvido.
    #
    # Quien decide si el software opera es license_services, y ese todavía
    # lee el formato anterior: un token JWT en licencia.lic. Ponerlo en
    # verdadero ahora dejaría al cliente con una licencia válida en la
    # mano y el programa bloqueado, porque el que vigila la puerta no
    # sabe leerla.
    #
    # Se pone en verdadero cuando license_services lea .rcslic. Hasta
    # entonces, la licencia se verifica aquí —el instalador no deja
    # instalar sin una buena— pero no bloquea después.
    escribir_env(False, idioma)
    token_del_asistente()

    _decir("Listo.")
    return 0
