# -*- mode: python ; coding: utf-8 -*-
"""Receta de PyInstaller para race-core-backend.exe.

Se usa un .spec y no una tira de banderas porque hacen falta tres cosas
que en la línea de órdenes quedan ilegibles: los módulos que se importan
por nombre y el analizador no ve, los datos que tienen que viajar dentro,
y el recorte de lo que no se usa.

    pyinstaller Backend/backend.spec --noconfirm --clean
"""

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

RAIZ = Path(SPECPATH).parent

# Beanie, Motor y Pydantic resuelven clases por su nombre en tiempo de
# ejecución. El analizador estático no ve esas importaciones, así que
# sin recogerlas enteras el .exe compila bien y luego revienta al
# arrancar, que es la peor forma de enterarse.
ocultos = []
for paquete in ("beanie", "motor", "pymongo", "pydantic", "pydantic_settings",
                "email_validator", "passlib", "bcrypt", "jwt", "cryptography",
                "uvicorn", "PIL"):
    ocultos += collect_submodules(paquete)

# Los routers y servicios se importan desde main por su nombre; van
# igualmente, pero se declaran para que no dependa del orden de análisis.
ocultos += collect_submodules("src")

datos = [
    # La versión, que config.py lee del disco al arrancar.
    (str(RAIZ / "VERSION"), "."),

    # Lo que se siembra en ProgramData la primera vez: logos de marcas y
    # el XML de demostración. Las fotos de pilotos NO: son del cliente.
    (str(RAIZ / "Backend" / "src" / "public" / "marcas"), "public/marcas"),
    (str(RAIZ / "Backend" / "src" / "public" / "demo"),   "public/demo"),

    # Las plantillas de CasparCG, que se reponen en cada actualización.
    (str(RAIZ / "Casparcg" / "template"), "plantillas"),
]

a = Analysis(
    [str(RAIZ / "Backend" / "servidor.py")],
    pathex=[str(RAIZ / "Backend")],
    binaries=[],
    datas=datos,
    hiddenimports=ocultos,
    hookspath=[],
    runtime_hooks=[],
    # Peso que no se usa: matplotlib y tkinter entran de rebote por
    # pandas y no los toca nadie.
    excludes=["matplotlib", "tkinter", "PyQt5", "PySide6", "notebook", "IPython"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name="race-core-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,                    # dispara a los antivirus
    console=True,
    disable_windowed_traceback=False,
    icon=str(RAIZ / "launcher" / "race-core-studio.ico"),
    version=str(RAIZ / "installer" / "version-info.txt"),
)
