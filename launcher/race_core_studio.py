"""Lanzador de Race Core Studio.

Arranca el sistema completo en el orden en que se necesita:

    1. CasparCG        (el servidor de gráficos, con su ventana)
    2. Base de datos   (solo se verifica; MongoDB corre como servicio)
    3. Backend         (FastAPI en el 8080, abierto a la red)
    4. Navegador       (abre el panel)

Todo va por un solo puerto. El backend sirve el API y también el panel ya
compilado que hay en Frontend/dist, así que aquí no se levanta ningún
servidor de desarrollo: en la máquina de un cliente no hay —ni debe
haber— Node instalado.

Cada paso espera a que el anterior responda de verdad antes de seguir. No
basta con lanzar el proceso: el backend tarda en levantar Beanie, y abrir
el navegador antes de tiempo muestra un error de conexión que parece un
fallo del sistema.

Los procesos quedan sueltos a propósito: cerrar esta ventana no los mata.
En medio de una transmisión, cerrar sin querer el lanzador no puede
tumbar los gráficos que están al aire.

    race-core-studio.exe             arranca todo
    race-core-studio.exe --detener   apaga CasparCG y el backend
"""

import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

# ─── Presentación ────────────────────────────────────────────

ROJO, VERDE, AMARILLO, GRIS, NEGRITA, FIN = (
    "\033[91m", "\033[92m", "\033[93m", "\033[90m", "\033[1m", "\033[0m",
)


def preparar_consola():
    """Colores y acentos en la consola de Windows.

    Sin esto los acentos salen como signos raros y los códigos de color
    se imprimen literales.
    """
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if os.name == "nt":
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            # 7 = stdout, ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            kernel32.SetConsoleOutputCP(65001)
        except Exception:
            pass


def esperar_enter(mensaje="Pulsa Enter para cerrar..."):
    """Pausa final.

    Al hacer doble clic en el .exe, la ventana se cerraría de golpe y no
    daría tiempo a leer nada. Con la entrada cerrada (lanzado desde un
    script) input() lanza EOFError, así que se ignora.
    """
    try:
        input(mensaje)
    except (EOFError, KeyboardInterrupt):
        pass


def titulo(texto):
    print(f"\n{NEGRITA}{texto}{FIN}")


# CasparCG, base de datos, backend y navegador. Se declara aquí para que
# el contador no se quede desfasado si algún día se añade o quita un paso.
TOTAL_PASOS = 4


def paso(n, texto):
    print(f"\n{NEGRITA}[{n}/{TOTAL_PASOS}]{FIN} {texto}")


def ok(texto):
    print(f"      {VERDE}OK{FIN}   {texto}")


def aviso(texto):
    print(f"      {AMARILLO}··{FIN}   {texto}")


def error(texto):
    print(f"      {ROJO}FALLO{FIN} {texto}")


def detalle(texto):
    print(f"           {GRIS}{texto}{FIN}")


# ─── Rutas ───────────────────────────────────────────────────

def raiz_proyecto() -> Path:
    """Carpeta Race-Core-Studio.

    Empaquetado, el .exe vive en la raíz. Sin empaquetar, el script vive
    en launcher/, un nivel más abajo.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


RAIZ = raiz_proyecto()


def _version() -> str:
    """La versión instalada, del archivo VERSION que va con el programa."""
    for candidato in (RAIZ / "VERSION", Path(getattr(sys, "_MEIPASS", RAIZ)) / "VERSION"):
        try:
            return candidato.read_text(encoding="utf-8").strip()
        except OSError:
            continue
    return "0.0.0-dev"


VERSION = _version()


def rutas_de_datos() -> Path:
    """Donde el backend guarda lo del cliente. Igual que Backend/rutas.py.

    No se importa aquel módulo porque el lanzador se congela aparte y no
    lleva el backend dentro; son ocho líneas y duplicarlas cuesta menos
    que arrastrar todo el paquete.
    """
    forzada = os.environ.get("RCS_DATOS")
    if forzada:
        return Path(forzada).expanduser().resolve()
    if os.name == "nt":
        return Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Race Core Studio"
    return Path.home() / ".local" / "share" / "Race Core Studio"
# Instalado, cada cosa está junto al lanzador y en minúsculas; sin
# congelar, donde la deja el repositorio. Se prueban los dos sitios y
# manda el que exista, para que el mismo archivo sirva en las dos
# situaciones sin una bandera que haya que acordarse de poner.

def _elegir(*candidatas: Path) -> Path:
    for c in candidatas:
        if c.exists():
            return c
    return candidatas[0]


CASPARCG = _elegir(RAIZ / "casparcg" / "casparcg.exe",
                   RAIZ / "Casparcg" / "casparcg.exe")

# El backend congelado. Cuando no está —árbol de desarrollo— se recurre
# al intérprete del entorno virtual, que es como se arrancaba antes.
BACKEND_EXE = _elegir(RAIZ / "backend" / "race-core-backend.exe",
                      RAIZ / "race-core-backend.exe")
BACKEND = RAIZ / "Backend"
PYTHON_VENV = BACKEND / "venv" / "Scripts" / "python.exe"

# Instalado, el programa vive en «Archivos de programa», que es de solo
# lectura: los registros van con el resto de datos del cliente.
LOGS = _elegir(rutas_de_datos() / "logs", RAIZ / "logs")
PIDS = LOGS / "procesos.json"

PUERTO_CASPARCG = 5250
PUERTO_BACKEND = 8080

# El panel lo sirve el propio backend, así que la dirección es la suya.
URL_PANEL = f"http://127.0.0.1:{PUERTO_BACKEND}/"

# Lo que el backend sirve como panel. Sin esto solo respondería el API.
# Instalado se llama «panel» y está junto al lanzador; en desarrollo es
# Frontend/dist, donde lo deja Vite.
FRONTEND_DIST = _elegir(RAIZ / "panel", RAIZ / "Frontend" / "dist")


# ─── Utilidades ──────────────────────────────────────────────

def puerto_abierto(puerto: int, host="localhost", espera=0.4) -> bool:
    """¿Hay algo escuchando en ese puerto?

    Se prueban todas las direcciones que resuelva el nombre, no solo
    127.0.0.1. Vite se ata a `localhost`, que en Windows resuelve primero
    a ::1 (IPv6): comprobando solo IPv4 el servidor parece caído aunque
    esté sirviendo perfectamente.
    """
    try:
        destinos = socket.getaddrinfo(host, puerto, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return False

    for familia, tipo, proto, _, direccion in destinos:
        try:
            with socket.socket(familia, tipo, proto) as s:
                s.settimeout(espera)
                if s.connect_ex(direccion) == 0:
                    return True
        except OSError:
            continue

    return False


def esperar(condicion, segundos: float, cada: float = 0.5) -> bool:
    """Reintenta hasta que la condición se cumpla o se acabe el tiempo.

    Muestra puntos para que no parezca colgado: el frontend puede tardar
    veinte segundos la primera vez que compila.
    """
    limite = time.time() + segundos
    puntos = 0

    while time.time() < limite:
        if condicion():
            if puntos:
                print()
            return True
        time.sleep(cada)
        puntos += 1
        if puntos % 4 == 0:
            print(".", end="", flush=True)

    if puntos:
        print()
    return False


def leer_env() -> dict:
    """Lee Backend/.env sin depender de python-dotenv."""
    valores = {}
    archivo = BACKEND / ".env"

    if not archivo.exists():
        return valores

    for linea in archivo.read_text(encoding="utf-8", errors="replace").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        valores[clave.strip()] = valor.strip()

    return valores


def lanzar(comando, cwd, log, nueva_consola=False):
    """Arranca un proceso que sobrevive al cierre del lanzador.

    Con `nueva_consola` la salida NO se captura: el proceso escribe en su
    propia ventana. Es el caso de CasparCG, y es deliberado. Redirigiendo
    su salida a un archivo la ventana queda en negro, y entonces no hay
    forma de distinguir "arrancó bien" de "no arrancó": justo la duda que
    esto provocó la primera vez.
    """
    LOGS.mkdir(exist_ok=True)
    salida = None if nueva_consola else open(
        LOGS / log, "w", encoding="utf-8", errors="replace"
    )

    entorno = os.environ.copy()
    # El backend imprime un emoji al conectar con Mongo. Con la salida
    # redirigida a un archivo, la codificación por defecto de Windows no
    # sabe escribirlo y el arranque muere antes de servir nada.
    entorno["PYTHONIOENCODING"] = "utf-8"

    banderas = 0
    if os.name == "nt":
        # CasparCG necesita su propia ventana; los demás no.
        banderas = (
            subprocess.CREATE_NEW_CONSOLE if nueva_consola
            else subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
        )

    proceso = subprocess.Popen(
        comando,
        cwd=str(cwd),
        stdout=salida,
        stderr=subprocess.STDOUT if salida else None,
        env=entorno,
        creationflags=banderas,
    )
    return proceso


def guardar_pids(pids: dict):
    LOGS.mkdir(exist_ok=True)
    PIDS.write_text(json.dumps(pids, indent=2), encoding="utf-8")


# ─── Pasos ───────────────────────────────────────────────────

def paso_casparcg() -> bool:
    paso(1, "Servidor de gráficos (CasparCG)")

    if puerto_abierto(PUERTO_CASPARCG):
        ok(f"ya estaba corriendo en el puerto {PUERTO_CASPARCG}")
        detalle("no se abre otra ventana: se reutiliza la que ya está")
        return True

    if not CASPARCG.exists():
        error("no encuentro casparcg.exe")
        detalle(f"esperaba: {CASPARCG}")
        return False

    # Un casparcg.exe de unos pocos cientos de bytes no es el programa: es
    # el puntero que deja Git LFS cuando se clonó sin tenerlo instalado.
    # Se comprueba antes de intentar ejecutarlo porque el error de Windows
    # al lanzarlo no menciona LFS por ningún lado, y es el fallo más común
    # en una instalación nueva.
    tamano = CASPARCG.stat().st_size
    if tamano < 100_000:
        error(f"casparcg.exe pesa solo {tamano} bytes: no es el programa")
        detalle("se clonó el repositorio sin Git LFS, así que en su lugar")
        detalle("hay un puntero de texto. Para arreglarlo:")
        detalle("   git lfs install")
        detalle("   git lfs pull")
        return False

    # cwd en la carpeta de CasparCG: lee casparcg.config y las plantillas
    # con rutas relativas, y desde otra carpeta arranca sin canales.
    try:
        proceso = lanzar([str(CASPARCG)], CASPARCG.parent, None, nueva_consola=True)
    except OSError as e:
        # Windows no deja claro por qué no arranca un ejecutable. Las dos
        # causas habituales son que falte el Visual C++ Redistributable o
        # que el archivo esté a medias.
        error("no se pudo ejecutar casparcg.exe")
        detalle(f"{type(e).__name__}: {e}")
        detalle("suele faltar el Visual C++ Redistributable 2015-2022:")
        detalle("   winget install Microsoft.VCRedist.2015+.x64")
        return False

    print("      arrancando", end="", flush=True)

    if not esperar(lambda: puerto_abierto(PUERTO_CASPARCG), 40):
        error("no respondió en el puerto 5250 tras 40 segundos")
        detalle("revisa la ventana de CasparCG que se acaba de abrir")
        return False

    ok(f"al aire (PID {proceso.pid})")
    guardar_pids({**leer_pids(), "casparcg": proceso.pid})
    return True


def paso_base_de_datos() -> bool:
    paso(2, "Base de datos (MongoDB)")

    env = leer_env()
    uri = env.get("MONGO_URI", "mongodb://localhost:27017")
    nombre = env.get("DB_NAME", "race-core-studio")

    detalle(f"{uri} · base «{nombre}»")

    try:
        from pymongo import MongoClient
    except ImportError:
        error("falta pymongo en el entorno del lanzador")
        return False

    try:
        cliente = MongoClient(uri, serverSelectionTimeoutMS=5000)
        cliente.admin.command("ping")
        base = cliente[nombre]
        conteos = {c: base[c].count_documents({}) for c in
                   ("users", "categories", "pilots", "vehicles")}
        cliente.close()
    except Exception as e:
        error("no se pudo conectar")
        detalle(f"{type(e).__name__}: {str(e)[:120]}")
        # El instalador lo registra con este nombre; una instalación
        # anterior, o un MongoDB que ya tuviera el cliente, usa el suyo.
        detalle("arráncalo con:  net start RaceCoreStudioDB")
        detalle("               (o net start MongoDB, si es uno anterior)")
        return False

    ok("conexión verificada")
    detalle(" · ".join(f"{n}: {v}" for n, v in conteos.items()))

    if conteos["users"] == 0:
        avisar_sin_usuarios()

    return True


def avisar_sin_usuarios() -> None:
    """Sin cuentas nadie entra, pero el remedio depende de dónde se quedó.

    Si el asistente sigue abierto —lo dice su token, que el backend borra
    al completarlo— lo que falta es terminarlo: ahí es donde se crean las
    tres cuentas. Mandar a nadie a seed_admin.py en ese punto es mandarlo
    por un camino que no es, y encima se lo salta.

    El enlace va con el token puesto. Es lo que el instalador enseñó una
    vez, y quien cierre esa pestaña no tiene de dónde sacarlo.
    """
    token = _elegir(rutas_de_datos() / "instalacion.token",
                    RAIZ / "Backend" / "instalacion.token")

    if token.is_file():
        try:
            clave = token.read_text(encoding="utf-8").strip()
        except OSError:
            clave = ""

        aviso("la instalación no se ha terminado todavía")
        detalle("las tres cuentas —dueño, administrador y estándar— se crean")
        detalle("en el asistente web, no a mano. Termínalo aquí:")
        detalle("")
        if clave:
            detalle(f"   http://127.0.0.1:{PUERTO_BACKEND}/instalacion?token={clave}")
        else:
            detalle(f"   no pude leer {token}")
        return

    aviso("no hay usuarios: nadie podrá entrar")
    detalle("el asistente ya se cerró, así que el dueño se crea a mano:")
    detalle("   Backend\\venv\\Scripts\\python.exe Backend\\seed_admin.py")


def paso_backend() -> bool:
    paso(3, "Backend y panel (FastAPI)")

    if puerto_abierto(PUERTO_BACKEND):
        ok(f"ya estaba corriendo en el puerto {PUERTO_BACKEND}")
        return True

    # Sin el panel compilado el backend arranca igual, pero sirviendo solo
    # el API: el navegador se abriría en una página que no existe. Vale más
    # pararse aquí y decir qué falta que enseñar un error del navegador.
    if not (FRONTEND_DIST / "index.html").is_file():
        error("falta el panel compilado")
        detalle(f"esperaba: {FRONTEND_DIST / 'index.html'}")
        detalle("compílalo con:  npm install --prefix Frontend")
        detalle("                npm run build --prefix Frontend")
        return False

    ok("panel compilado encontrado")

    # El host sale del .env y no va clavado aqui: con 0.0.0.0 el backend
    # atiende tambien a otras maquinas de la red, que es lo que hace falta
    # cuando alguien opera la interfaz desde su propio equipo.
    host = leer_env().get("API_HOST", "127.0.0.1")

    # Hay dos formas de arrancarlo y solo una existe en cada equipo:
    # instalado, el ejecutable congelado; en el árbol de desarrollo, el
    # intérprete del entorno virtual. Se comprueba la que se vaya a usar,
    # no una fija: exigir el entorno virtual en una instalación es pedir
    # algo que ahí no existe ni tiene por qué.
    if BACKEND_EXE.is_file():
        orden, donde = [str(BACKEND_EXE)], RAIZ
    elif PYTHON_VENV.exists():
        orden = [str(PYTHON_VENV), "-m", "uvicorn", "main:app",
                 "--host", host, "--port", str(PUERTO_BACKEND)]
        donde = BACKEND
    else:
        error("no encuentro con qué arrancar el backend")
        detalle(f"ni {BACKEND_EXE.name} junto al lanzador")
        detalle(f"ni el entorno virtual en {PYTHON_VENV}")
        detalle("")
        detalle("si es una instalación, vuelve a ejecutar rcs-setup.exe")
        detalle("si es el repositorio:  python -m venv Backend\\venv")
        return False

    proceso = lanzar(orden, donde, "backend.log")
    print("      arrancando", end="", flush=True)

    # No basta con que el puerto abra: uvicorn escucha antes de terminar de
    # levantar Beanie. Se pregunta por una ruta real.
    def responde():
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{PUERTO_BACKEND}/openapi.json", timeout=2
            ) as r:
                return r.getcode() == 200
        except (urllib.error.URLError, OSError):
            return False

    if not esperar(responde, 45):
        error("no respondió tras 45 segundos")
        detalle(f"mira el detalle en: {LOGS / 'backend.log'}")
        return False

    ok(f"API y panel en http://127.0.0.1:{PUERTO_BACKEND} (PID {proceso.pid})")
    detalle(f"documentación del API: http://127.0.0.1:{PUERTO_BACKEND}/docs")
    guardar_pids({**leer_pids(), "backend": proceso.pid})
    return True


def paso_navegador() -> bool:
    paso(4, "Abriendo el panel")

    try:
        webbrowser.open(URL_PANEL)
        ok(URL_PANEL)
        return True
    except Exception as e:
        aviso("no pude abrir el navegador solo")
        detalle(f"entra a mano: {URL_PANEL}  ({type(e).__name__})")
        return True   # no es motivo para dar el arranque por fallido


# ─── Apagado ─────────────────────────────────────────────────

def pids_en_puerto(puerto: int) -> set:
    """PIDs escuchando en ese puerto, leyendo netstat.

    Sirve cuando el proceso no está en el archivo de PIDs: lo arrancó otra
    persona, o el archivo se perdió.
    """
    import re

    try:
        salida = subprocess.run(["netstat", "-ano"],
                                capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return set()

    patron = re.compile(r"^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$", re.M)
    return {int(pid) for p, pid in patron.findall(salida) if int(p) == puerto}


def leer_pids() -> dict:
    try:
        return json.loads(PIDS.read_text(encoding="utf-8"))
    except Exception:
        return {}


def detener():
    titulo("Deteniendo Race Core Studio")

    pids = leer_pids()
    if not pids:
        aviso("no hay procesos registrados")
        detalle(f"esperaba encontrarlos en {PIDS}")

    # Se cierra también CasparCG, igual que el botón "Detener Race Core
    # Studio" del panel: tener dos formas de apagar con alcances distintos
    # solo genera dudas sobre qué quedó vivo. MongoDB nunca se toca.
    #
    # Ya no hay proceso de frontend: el panel lo sirve el backend, así que
    # se va con él.
    for nombre in ("casparcg", "backend"):
        pid = pids.get(nombre)
        if not pid:
            continue
        # /T arrastra a los hijos por si el proceso dejó alguno colgando.
        r = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            ok(f"{nombre} detenido (PID {pid})")
        else:
            aviso(f"{nombre} ya no estaba corriendo (PID {pid})")

    # Puede quedar vivo si lo arrancó otra persona y no está en el
    # archivo de PIDs; se busca por el puerto antes de darse por vencido.
    if puerto_abierto(PUERTO_CASPARCG):
        for pid in pids_en_puerto(PUERTO_CASPARCG):
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                           capture_output=True, text=True)
            ok(f"CasparCG detenido (PID {pid})")

    if puerto_abierto(PUERTO_CASPARCG):
        aviso("CasparCG sigue respondiendo; ciérralo desde su propia ventana")

    detalle("MongoDB no se toca: es un servicio de Windows")
    guardar_pids({})
    print()


# ─── Principal ───────────────────────────────────────────────

def main():
    preparar_consola()

    if "--detener" in sys.argv:
        detener()
        esperar_enter()
        return 0

    if "--comprobar-casparcg" in sys.argv:
        return comprobar_casparcg()

    # Por defecto, la ventana. La consola solo con --consola, que queda
    # para desarrollo y para cuando haya que ver el arranque entero: un
    # cliente no tiene por qué leer una pantalla negra para abrir su
    # programa, y si algo falla el panel lo dice con palabras.
    if "--consola" not in sys.argv:
        return abrir_panel_grafico()

    print(f"\n{NEGRITA}  RACE CORE STUDIO{FIN}  {GRIS}v{VERSION}{FIN}")
    print(f"{GRIS}  {RAIZ}{FIN}")

    pasos = [
        ("CasparCG", paso_casparcg),
        ("base de datos", paso_base_de_datos),
        ("backend", paso_backend),
        ("navegador", paso_navegador),
    ]

    for nombre, ejecutar in pasos:
        if not ejecutar():
            # Se corta en el primer fallo: seguir sin base de datos solo
            # produce un segundo error más confuso que el primero.
            titulo(f"{ROJO}Arranque detenido en: {nombre}{FIN}")
            print("\nCorrige lo de arriba y vuelve a ejecutar este archivo.\n")
            esperar_enter()
            return 1

    titulo(f"{VERDE}Todo listo{FIN}")
    print(f"""
  Panel      {URL_PANEL}
  API        http://127.0.0.1:{PUERTO_BACKEND}/docs
  Registros  {LOGS}

{GRIS}  Cerrar esta ventana NO apaga nada: los servicios quedan corriendo
  para que un cierre accidental no tumbe los gráficos al aire.
  Para apagar todo:  race-core-studio.exe --detener
  (o el botón «Detener Race Core Studio» del panel){FIN}
""")
    esperar_enter("Pulsa Enter para cerrar esta ventana...")
    return 0


# ─── El mando del panel ──────────────────────────────────────
#
# Conecta los botones de la ventana con los servicios. Todo lo que tarda
# corre en otro hilo y avisa por la cola del panel: si se hiciera en el
# hilo de la ventana, arrancar CasparCG la dejaría congelada diez
# segundos y parecería colgada.

ERROR_LOG = LOGS / "error.log"


def anotar(texto: str) -> None:
    """Una línea en error.log. Es lo que abre el botón del panel."""
    from datetime import datetime

    try:
        LOGS.mkdir(parents=True, exist_ok=True)
        with open(ERROR_LOG, "a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  {texto}\n")
    except OSError:
        pass


class Mando:
    """Lo que el panel sabe pedir."""

    def __init__(self):
        self.panel = None
        self.procesos = {}

    # ── Consultas ──

    def estado_mongo(self) -> str:
        return "on" if puerto_abierto(27017) else "error"

    def estado_caspar(self) -> str:
        return "aire" if puerto_abierto(PUERTO_CASPARCG) else "off"

    def estado_rcs(self) -> str:
        return "on" if puerto_abierto(PUERTO_BACKEND) else "off"

    def _refrescar(self) -> None:
        self.panel.avisar("mongo", self.estado_mongo())
        self.panel.avisar("caspar", self.estado_caspar())
        self.panel.avisar("rcs", self.estado_rcs())

    # ── Arrancar ──

    def arrancar_mongo(self) -> None:
        def trabajo():
            self.panel.avisar("mongo", "wait")
            if os.name == "nt":
                for servicio in ("RaceCoreStudioDB", "MongoDB"):
                    subprocess.run(["net", "start", servicio],
                                   capture_output=True,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
                    if puerto_abierto(27017):
                        break
            esperar(lambda: puerto_abierto(27017), 20)
            estado = self.estado_mongo()
            if estado == "error":
                anotar("MongoDB no arrancó: el servicio no responde en el 27017")
                self.panel.avisar("aviso",
                    "La base de datos no arranca. Sin ella no se puede abrir el "
                    "panel. Si el problema sigue, manda error.log a soporte.")
            self.panel.avisar("mongo", estado)

        threading.Thread(target=trabajo, daemon=True).start()

    def arrancar_caspar(self) -> None:
        def trabajo():
            if puerto_abierto(PUERTO_CASPARCG):
                self.panel.avisar("caspar", "aire")
                return
            self.panel.avisar("caspar", "wait")

            if not CASPARCG.is_file():
                anotar(f"No se encontró CasparCG en {CASPARCG}")
                self.panel.avisar("caspar", "off")
                self.panel.avisar("aviso",
                    "No encuentro el servidor de gráficos. Vuelve a ejecutar "
                    "rcs-setup.exe para reinstalarlo.")
                return

            try:
                self.procesos["casparcg"] = lanzar(
                    [str(CASPARCG)], CASPARCG.parent, "casparcg.log",
                    nueva_consola=True)
            except OSError as e:
                anotar(f"CasparCG no se pudo lanzar: {type(e).__name__}: {e}")
                self.panel.avisar("caspar", "off")
                return

            if not esperar(lambda: puerto_abierto(PUERTO_CASPARCG), 40):
                anotar("CasparCG arrancó pero no abrió el puerto 5250")
                self.panel.avisar("aviso",
                    "El servidor de gráficos no responde. El panel funciona, "
                    "pero no saldrá ningún gráfico al aire.")
            self.panel.avisar("caspar", self.estado_caspar())

        threading.Thread(target=trabajo, daemon=True).start()

    def arrancar_rcs(self) -> None:
        def trabajo():
            if puerto_abierto(PUERTO_BACKEND):
                self.panel.avisar("rcs", "on")
                self.panel.avisar("listo", True)
                return
            self.panel.avisar("rcs", "wait")

            host = leer_env().get("API_HOST", "0.0.0.0")

            if BACKEND_EXE.is_file():
                orden, donde = [str(BACKEND_EXE)], RAIZ
            elif PYTHON_VENV.exists():
                orden = [str(PYTHON_VENV), "-m", "uvicorn", "main:app",
                         "--host", host, "--port", str(PUERTO_BACKEND)]
                donde = BACKEND
            else:
                anotar("No hay con qué arrancar el backend: ni el ejecutable "
                       "congelado ni el entorno virtual")
                self.panel.avisar("rcs", "off")
                self.panel.avisar("aviso",
                    "Falta el programa principal. Vuelve a ejecutar rcs-setup.exe.")
                return

            try:
                self.procesos["backend"] = lanzar(orden, donde, "backend.log")
            except OSError as e:
                anotar(f"El backend no se pudo lanzar: {type(e).__name__}: {e}")
                self.panel.avisar("rcs", "off")
                return

            if esperar(lambda: puerto_abierto(PUERTO_BACKEND), 90):
                self.panel.avisar("rcs", "on")
                self.panel.avisar("listo", True)
            else:
                anotar("El backend no respondió en 90 segundos. "
                       f"Ver {LOGS / 'backend.log'}")
                self.panel.avisar("rcs", "error")
                self.panel.avisar("aviso",
                    "Race Core Studio no acabó de arrancar. Mira error.log, "
                    "o mándalo a soporte.")

        threading.Thread(target=trabajo, daemon=True).start()

    # ── Detener ──

    def _matar(self, nombre: str, puerto: int, clave: str) -> None:
        def trabajo():
            for pid in pids_en_puerto(puerto):
                try:
                    os.kill(pid, signal.SIGTERM)
                except (OSError, ProcessLookupError):
                    pass
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(
                    self.procesos[nombre].pid)] if nombre in self.procesos else
                    ["cmd", "/c", "exit"], capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW)
            esperar(lambda: not puerto_abierto(puerto), 15)
            self.panel.avisar(clave, "off")
            if clave == "rcs":
                self.panel.avisar("listo", False)

        threading.Thread(target=trabajo, daemon=True).start()

    def detener_caspar(self) -> None:
        self._matar("casparcg", PUERTO_CASPARCG, "caspar")

    def detener_rcs(self) -> None:
        self._matar("backend", PUERTO_BACKEND, "rcs")

    # ── Lo que hace al abrirse ──

    def arrancar_todo(self) -> None:
        """Todo solo, sin que nadie pulse nada. Y al final se aparta."""
        anotar(f"--- Arranque · Race Core Studio {VERSION} ---")
        self._refrescar()

        if not puerto_abierto(27017):
            self.arrancar_mongo()
            esperar(lambda: puerto_abierto(27017), 25)
        self.panel.avisar("mongo", self.estado_mongo())

        self.arrancar_caspar()
        self.arrancar_rcs()

        # A esperar a que el panel web conteste para abrirlo.
        if esperar(lambda: puerto_abierto(PUERTO_BACKEND), 120):
            self.panel.avisar("red", f"Desde otro equipo:  http://{ip_de_la_red()}:{PUERTO_BACKEND}")
            self.abrir_panel()
            # Se aparta: el operador trabaja en el navegador, no aquí.
            # Sigue viva en la barra de tareas por si hay que volver.
            self.panel.avisar("minimizar", True)
        else:
            anotar("No se llegó a abrir el panel: el backend no respondió")

        guardar_pids({n: p.pid for n, p in self.procesos.items() if p})

    # ── Botones sueltos ──

    def abrir_panel(self) -> None:
        from panel import abrir_en_navegador
        abrir_en_navegador(URL_PANEL)

    def abrir_registro(self) -> None:
        """Abre error.log con lo que Windows use para los .log."""
        anotar("(el operador abrió el registro)")
        try:
            if os.name == "nt":
                os.startfile(str(ERROR_LOG))
            else:
                subprocess.run(["xdg-open", str(ERROR_LOG)], check=False)
        except OSError as e:
            anotar(f"No se pudo abrir el registro: {e}")


def ip_de_la_red() -> str:
    """La IP con la que se llega a este equipo desde la red local."""
    import socket

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))          # no manda nada; solo elige ruta
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def abrir_panel_grafico() -> int:
    from panel import Panel

    mando = Mando()
    ventana = Panel(VERSION, mando)
    mando.panel = ventana
    ventana.correr()
    return 0


def comprobar_casparcg() -> int:
    """Arranca CasparCG, comprueba que responde y lo cierra.

    Lo llama el instalador al terminar de copiar. La idea es no dejar que
    el cliente descubra en su primera carrera que el servidor de gráficos
    no levanta en ese equipo: si algo falla —permisos, la tarjeta de
    vídeo, un códec— que se sepa ahora, con el instalador todavía
    delante.

    Se cierra al acabar porque esto es una comprobación, no el arranque
    del sistema. Si no se deja cerrar, se dice en el código de salida y
    el instalador avisa de que hay una ventana que cerrar a mano.

        0  responde y se cerró
        1  no llegó a responder
        2  responde, pero quedó abierto
    """
    anotar("--- Comprobación de CasparCG (instalación) ---")

    # El puerto primero: lo que importa es que haya un servidor de
    # gráficos atendiendo, no dónde esté el ejecutable. Si ya hay uno
    # —suyo, de otra instalación— no se toca ni se cierra: puede estar
    # al aire.
    if puerto_abierto(PUERTO_CASPARCG):
        anotar("Ya había un CasparCG en marcha; no se toca")
        return 0

    if not CASPARCG.is_file():
        anotar(f"No está casparcg.exe en {CASPARCG}")
        return 1

    try:
        lanzar([str(CASPARCG)], CASPARCG.parent, "casparcg.log", nueva_consola=True)
    except OSError as e:
        anotar(f"No se pudo lanzar CasparCG: {type(e).__name__}: {e}")
        return 1

    if not esperar(lambda: puerto_abierto(PUERTO_CASPARCG), 60):
        anotar("CasparCG arrancó pero no abrió el 5250 en 60 segundos")
        cerrar_casparcg()
        return 1

    anotar("CasparCG responde en el 5250")

    if cerrar_casparcg():
        anotar("Comprobado y cerrado")
        return 0

    anotar("Comprobado, pero no se pudo cerrar")
    return 2


def cerrar_casparcg() -> bool:
    """Lo cierra y espera a que suelte el puerto."""
    for pid in pids_en_puerto(PUERTO_CASPARCG):
        try:
            os.kill(pid, signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass

    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/IM", "casparcg.exe"],
                       capture_output=True,
                       creationflags=subprocess.CREATE_NO_WINDOW)

    return esperar(lambda: not puerto_abierto(PUERTO_CASPARCG), 20)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrumpido.")
        sys.exit(130)
