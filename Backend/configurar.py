"""Deja el sistema listo para el primer arranque.

Es lo que hacía installer/instalar.py cuando el instalador clonaba el
repositorio y compilaba en el equipo del cliente. Ahora vive aquí, dentro
del backend congelado, porque es el único que lleva encima lo que hace
falta: el validador de licencias, el emisor y la huella del equipo.

    race-core-backend.exe --configurar --correo … --licencia …\licencia.rcslic

Hace cuatro cosas, en este orden:

    1. Verifica el archivo de licencia. Si no vale, no se toca nada más.
    2. Lo guarda en la carpeta de datos, para que el backend lo relea en
       cada arranque.
    3. Escribe el .env, con una firma de sesiones distinta en cada
       instalación.
    4. Genera el token del asistente web.

La licencia ya viene firmada por Zentogo, así que aquí no se emite nada:
solo se comprueba. Antes había que emitirla en el equipo del cliente
—la clave RCS1 era un simple sí o no— y eso exigía la clave privada de
Zentogo, que no puede viajar con el producto. Ver Backend/rcslic.py.

Se puede repetir sin miedo: renovar una licencia es volver a ejecutarlo.
Lo que ya existe y sigue valiendo, se respeta.
"""

import re
import secrets
from pathlib import Path

import rutas


def _decir(texto: str = "") -> None:
    print(texto, flush=True)


# ─── 1 · El correo ───────────────────────────────────────────

# Solo la forma, y holgada a propósito. El correo es para avisar de
# renovaciones y para que soporte sepa con quién habla; quien decide si
# se puede instalar es la licencia. Una expresión estricta rechazaría
# direcciones perfectamente válidas —las hay con + y con dominios de
# cualquier largo— y eso dejaría a un cliente sin poder instalar lo que
# ya pagó.
FORMA_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def comprobar_correo(correo: str) -> str | None:
    """El correo normalizado, o None si no tiene forma de correo."""
    correo = (correo or "").strip()
    if not FORMA_CORREO.match(correo):
        _decir(f"CORREO: «{correo}» no tiene forma de dirección de correo.")
        return None
    return correo


# ─── 2 · La licencia ─────────────────────────────────────────

def comprobar_licencia(ruta: str) -> "rcslic.Licencia | None":
    """Verifica el archivo .rcslic. Sin esto no se sigue instalando."""
    import rcslic

    try:
        lic = rcslic.leer(ruta)
    except rcslic.LicenciaInvalida as e:
        _decir(f"LICENCIA: {e}")
        return None

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

def configurar(correo: str, licencia: str, idioma: str = "") -> int:
    _decir(f"Race Core Studio · configurando en {rutas.DATOS}")
    rutas.preparar()

    if comprobar_correo(correo) is None:
        return 1

    lic = comprobar_licencia(licencia)
    if lic is None:
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
