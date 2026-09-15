"""Deja el sistema listo para el primer arranque.

Es lo que hacía installer/instalar.py cuando el instalador clonaba el
repositorio y compilaba en el equipo del cliente. Ahora vive aquí, dentro
del backend congelado, porque es el único que lleva encima lo que hace
falta: el validador de licencias, el emisor y la huella del equipo.

    race-core-backend.exe --configurar --correo … --clave …

Hace cuatro cosas, en este orden:

    1. Valida la licencia. Si no vale, no se toca nada más.
    2. La emite atada a la huella de ESTE equipo.
    3. Escribe el .env, con una firma de sesiones distinta en cada
       instalación.
    4. Genera el token del asistente web.

Se puede repetir sin miedo: renovar una licencia es volver a ejecutarlo.
Lo que ya existe y sigue valiendo, se respeta.
"""

import secrets

import rutas


def _decir(texto: str = "") -> None:
    print(texto, flush=True)


# ─── 1 y 2 · La licencia ─────────────────────────────────────

def comprobar_licencia(correo: str, clave: str) -> dict | None:
    """Valida correo y clave. Sin esto no se sigue instalando."""
    from licencia_local import validar

    resultado = validar(correo, clave)
    if not resultado["ok"]:
        _decir(f"LICENCIA: {resultado['error']}")
        return None

    _decir(f"Licencia válida para {resultado['correo']} · plan {resultado['plan']}")
    return resultado


def emitir_para_este_equipo(lic: dict, dias: int | None) -> bool:
    """Ata la licencia a la huella de este equipo. Puede no poder.

    Firmar exige la clave privada de Zentogo, y esa no viaja NUNCA con
    el producto: quien la tenga puede fabricarse licencias perpetuas para
    cualquier máquina. En su sitio irá el servidor de licencias, que
    firma él y manda el token ya hecho.

    Mientras ese servidor no exista, aquí solo se emite si alguien dejó
    la clave a mano a propósito —un equipo de desarrollo—. En cualquier
    otro sitio se sigue adelante sin licencia emitida, y se dice.
    """
    privada = rutas.DATOS / "claves" / "licencias-privada.pem"

    if not privada.is_file():
        _decir()
        _decir("AVISO: no se emite licencia atada a este equipo.")
        _decir("  Firmarla exige la clave privada de Zentogo, que no viaja")
        _decir("  con el producto. La emitirá el servidor de licencias.")
        _decir("  Hasta entonces el software queda sin exigir licencia.")
        return False

    from emitir import emitir
    from src.services.fingerprint_services import huella_equipo

    huella = huella_equipo()
    _decir(f"Equipo: {huella[:24]}…")

    token, datos = emitir(
        privada_pem=privada.read_text(encoding="utf-8"),
        producto="race-core-studio",
        cliente=lic.get("cliente", "Autódromo"),
        correo=lic["correo"],
        equipo=huella,
        dias=dias if dias is not None else lic["dias"],
        plan=lic["plan"],
        version_max="1.0.0",
        gracia_dias=lic["gracia_dias"],
        revalidar_dias=7,
    )

    (rutas.DATOS / "licencia.lic").write_text(token, encoding="utf-8")
    _decir("Licencia emitida y atada a este equipo.")
    return True


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

def configurar(correo: str, clave: str, dias: int | None = None,
               idioma: str = "") -> int:
    _decir(f"Race Core Studio · configurando en {rutas.DATOS}")
    rutas.preparar()

    lic = comprobar_licencia(correo, clave)
    if lic is None:
        return 1

    emitida = emitir_para_este_equipo(lic, dias)
    escribir_env(emitida, idioma)
    token_del_asistente()

    _decir("Listo.")
    return 0
