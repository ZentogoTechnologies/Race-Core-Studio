"""Lo que dice la ventana de servicios, en los dos idiomas.

El lanzador se congela aparte del backend y no habla con MongoDB, así
que no puede preguntarle a la base en qué idioma está puesto el sistema.
Lo lee del .env, donde lo deja el instalador al configurar y el backend
lo reescribe en cada arranque con lo que se haya elegido en Ajustes.

Un diccionario y no gettext: son veinte cadenas, no hay plurales que
declinar, y un .mo más que empaquetar es una forma de que falte.
"""

import os
from pathlib import Path

POR_DEFECTO = "es"

TEXTOS = {
    "es": {
        "abriendo":       "ABRIENDO…",
        "abrir_panel":    "ABRIR EL PANEL",
        "arrancar":       "Arrancar",
        "detener":        "Detener",
        "base_datos":     "Base de datos",
        "base_detalle":   "MongoDB · puerto 27017",
        "graficos":       "Servidor de gráficos",
        "graficos_det":   "CasparCG · puerto 5250",
        "programa":       "Race Core Studio",
        "programa_det":   "Panel y API · puerto 8080",
        "ver_registro":   "Ver error.log",
        "desde_otro":     "Desde otro equipo:",
        "est_on":         "EN MARCHA",
        "est_aire":       "AL AIRE",
        "est_wait":       "ARRANCANDO",
        "est_off":        "DETENIDO",
        "est_espera":     "EN ESPERA",
        "est_error":      "NO RESPONDE",
    },
    "en": {
        "abriendo":       "OPENING…",
        "abrir_panel":    "OPEN THE PANEL",
        "arrancar":       "Start",
        "detener":        "Stop",
        "base_datos":     "Database",
        "base_detalle":   "MongoDB · port 27017",
        "graficos":       "Graphics server",
        "graficos_det":   "CasparCG · port 5250",
        "programa":       "Race Core Studio",
        "programa_det":   "Panel and API · port 8080",
        "ver_registro":   "View error.log",
        "desde_otro":     "From another computer:",
        "est_on":         "RUNNING",
        "est_aire":       "ON AIR",
        "est_wait":       "STARTING",
        "est_off":        "STOPPED",
        "est_espera":     "WAITING",
        "est_error":      "NOT RESPONDING",
    },
}


def _carpeta_de_datos() -> Path:
    """Igual que Backend/rutas.py. Se duplica por lo mismo que allí."""
    forzada = os.environ.get("RCS_DATOS")
    if forzada:
        return Path(forzada).expanduser().resolve()
    if os.name == "nt":
        return Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Race Core Studio"
    return Path.home() / ".local" / "share" / "Race Core Studio"


def idioma() -> str:
    """El idioma del .env. Español si no hay, si no se puede leer, o si
    dice algo que no conocemos: la ventana tiene que pintarse igual."""
    forzado = (os.environ.get("RCS_IDIOMA") or "").strip().lower()
    if forzado in TEXTOS:
        return forzado

    archivo = _carpeta_de_datos() / ".env"
    try:
        for linea in archivo.read_text(encoding="utf-8").splitlines():
            clave, _, valor = linea.partition("=")
            if clave.strip() == "IDIOMA":
                elegido = valor.strip().lower()
                if elegido in TEXTOS:
                    return elegido
    except OSError:
        pass
    return POR_DEFECTO


def t(clave: str) -> str:
    """El texto en el idioma puesto; la clave misma si alguien la escribió mal."""
    return TEXTOS.get(idioma(), TEXTOS[POR_DEFECTO]).get(clave, clave)
