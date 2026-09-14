"""Dónde está cada cosa, congelado o no.

Sin congelar, todo cuelga del repositorio y `__file__` basta. Dentro de
un .exe de PyInstaller no: ahí `__file__` apunta a la carpeta temporal
donde el ejecutable se descomprime al arrancar, y Windows la borra al
salir. Lo que se escriba ahí desaparece sin dejar rastro, y lo que se lea
de ahí solo existe mientras el proceso vive.

Por eso hay tres raíces y no una:

    APP        donde está instalado el programa. Es de solo lectura: en
               «Archivos de programa» un usuario normal no puede escribir.
    RECURSOS   lo que viaja dentro del ejecutable —plantillas, panel,
               logos de marcas—. Se repone entero en cada actualización.
    DATOS      lo del cliente: fotos de pilotos, logos, licencia,
               configuración y registros. Sobrevive a actualizar, y a
               desinstalar y volver a instalar.

Tenerlas mezcladas es lo que hace que una actualización se lleve por
delante las fotos de los pilotos, o que la licencia desaparezca al
reinstalar. Separarlas cuesta este archivo.
"""

import os
import shutil
import sys
from pathlib import Path

# PyInstaller pone esto; ejecutando el código suelto no existe.
CONGELADO = getattr(sys, "frozen", False)

# El .py vive en Backend/, así que sin congelar esa es la raíz de todo.
_FUENTE = Path(__file__).resolve().parent


def _app() -> Path:
    """La carpeta del programa instalado.

    El backend congelado vive en su propia subcarpeta —{app}\\backend—
    porque PyInstaller reparte ahí sus bibliotecas. Pero el panel y
    CasparCG están un nivel más arriba, junto al lanzador, así que la
    raíz del programa es la de encima. Sin esto, el backend busca el
    panel dentro de su propia carpeta y arranca sirviendo solo el API.
    """
    if not CONGELADO:
        return _FUENTE

    aqui = Path(sys.executable).resolve().parent
    return aqui.parent if aqui.name.lower() == "backend" else aqui


def _recursos() -> Path:
    """Lo que viaja dentro del ejecutable.

    _MEIPASS es la carpeta temporal de PyInstaller. Se consulta con
    getattr porque en un build --onedir no existe: ahí los recursos
    quedan junto al .exe.
    """
    if CONGELADO:
        return Path(getattr(sys, "_MEIPASS", _app())).resolve()
    return _FUENTE


def _datos() -> Path:
    """Donde se escribe. Nunca dentro del programa.

    RCS_DATOS manda si está puesta: hace falta para las pruebas, y para
    que un autódromo pueda llevarse los datos a otro disco sin tocar
    nada más.
    """
    forzada = os.environ.get("RCS_DATOS")
    if forzada:
        return Path(forzada).expanduser().resolve()

    if not CONGELADO:
        return _FUENTE

    if os.name == "nt":
        # ProgramData y no la carpeta del usuario: el servicio corre con
        # otra cuenta, y los datos son de la instalación, no de quien
        # esté sentado delante.
        base = Path(os.environ.get("ProgramData", r"C:\ProgramData"))
    else:
        base = Path.home() / ".local" / "share"

    return base / "Race Core Studio"


APP = _app()
RECURSOS = _recursos()
DATOS = _datos()

# Lo que sube el cliente. Se sirve en /public. Sin congelar se queda
# donde siempre ha estado, para no mover de sitio nada en desarrollo.
PUBLICO = (DATOS / "public") if CONGELADO else (_FUENTE / "src" / "public")

# Lo que se instala con el programa y se repone al actualizar.
PANEL = (APP / "panel") if CONGELADO else (_FUENTE.parent / "Frontend" / "dist")

# Las plantillas son producto, pero tienen que poder escribirse: el logo
# del cliente vive dentro, y las veintidós lo piden en relativo
# («../img/logo-cliente.png»). Van a DATOS y se refrescan al actualizar.
PLANTILLAS = (DATOS / "plantillas") if CONGELADO else (_FUENTE.parent / "Casparcg" / "template")

# Lo único de ahí dentro que es del cliente y no se pisa al actualizar.
PROPIAS_DEL_CLIENTE = ("img/logo-cliente.png",)

# Carpetas de /public que trae el producto, no el cliente. Se siembran en
# el primer arranque y desde entonces son suyas: si borra un logo de
# marca que no usa, no vuelve a aparecer en cada actualización.
SEMBRADAS = ("marcas", "demo")

# Las que se llenan solo con lo que suba.
SUBIDAS = ("pilotos", "vehiculos", "categorias", "eventos", "trazados")


def preparar() -> None:
    """Deja el árbol de datos listo. Se llama una vez, al arrancar."""
    for nombre in SUBIDAS + SEMBRADAS:
        (PUBLICO / nombre).mkdir(parents=True, exist_ok=True)

    (DATOS / "logs").mkdir(parents=True, exist_ok=True)
    PLANTILLAS.mkdir(parents=True, exist_ok=True)

    if not CONGELADO:
        return

    # Copiar, no enlazar: lo que se descomprime en _MEIPASS deja de
    # existir en cuanto el proceso termina.
    for nombre in SEMBRADAS:
        origen = RECURSOS / "public" / nombre
        if not origen.is_dir():
            continue
        for archivo in origen.iterdir():
            destino = PUBLICO / nombre / archivo.name
            if archivo.is_file() and not destino.exists():
                shutil.copy2(archivo, destino)

    _refrescar_plantillas()


def _refrescar_plantillas() -> None:
    """Repone las plantillas desde el ejecutable, salvo lo del cliente.

    Se sobrescriben siempre y no solo si faltan: un arreglo en un gráfico
    tiene que llegar al actualizar. La excepción es el logo del cliente,
    que es suyo y no se toca —perderlo al actualizar significa salir al
    aire con el logo de otro—.
    """
    origen = RECURSOS / "plantillas"
    if not origen.is_dir():
        return

    intocables = {PLANTILLAS / p for p in PROPIAS_DEL_CLIENTE}

    for archivo in origen.rglob("*"):
        if not archivo.is_file():
            continue

        destino = PLANTILLAS / archivo.relative_to(origen)
        if destino in intocables and destino.exists():
            continue

        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archivo, destino)


def describir() -> dict:
    """Para los registros y para el paso de diagnóstico del lanzador."""
    return {
        "congelado": CONGELADO,
        "app": str(APP),
        "recursos": str(RECURSOS),
        "datos": str(DATOS),
        "publico": str(PUBLICO),
        "panel": str(PANEL),
        "plantillas": str(PLANTILLAS),
    }
