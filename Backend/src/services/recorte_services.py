"""Quita el fondo de una foto y deja al piloto recortado.

Se hace en el servidor y no en el navegador ni en una nube. En el
autódromo la red se cae o está aislada, y una foto que no se puede
recortar porque no hay internet es una foto que se queda con el fondo del
taller. El modelo va en disco y funciona sin conexión.

Antes esto pasaba por rembg. Se usa el mismo modelo, con el mismo
tratamiento de la imagen, pero llamándolo directamente con onnxruntime:
rembg arrastra unos 360 MB de librerías que aquí no se usan —scipy,
numba, llvmlite, scikit-image— y numba y llvmlite son de lo peor que hay
para empaquetar en un .exe. Lo que de verdad hace el recorte son
onnxruntime (45 MB) y el modelo.

El modelo se carga una sola vez y se guarda: la primera llamada tarda unos
segundos y las siguientes son inmediatas.
"""

import hashlib
import io
import os
import sys
import tempfile
import threading
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

# Un modelo por tipo de sujeto. u2net_human_seg está entrenado solo con
# personas y acierta mucho más en gorras y pelo, que es donde se nota un
# recorte malo; pero delante de un carro no sabe qué mirar. El general sí,
# y a cambio es peor con el pelo.
#
# Da igual que la foto de catálogo del BMW saliera bien con el de personas:
# venía con el fondo ya blanco. La prueba de verdad es un carro en boxes,
# con gente y carpas detrás.
MODELOS = {
    "persona": "u2net_human_seg",
    "objeto":  "u2net",
}

# De dónde se bajan si no están en el equipo, y su huella. Son las
# descargas oficiales que usaba rembg, con las mismas sumas MD5: un modelo
# cortado a medias cargaría igual y recortaría basura sin avisar.
DESCARGAS = {
    "u2net": (
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
        "60024c5c889badc19c04ad937298a77b",
    ),
    "u2net_human_seg": (
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx",
        "c09ddc2e0104f800e3e1bb4652583d1f",
    ),
}

# Las fotos llegan de un iPad a 4000px de ancho y el arte no las necesita:
# el retrato más grande que se pinta es el de la grilla, que ocupa media
# pantalla. Reducir antes de recortar baja el trabajo del modelo de
# segundos a décimas y el PNG resultante de cinco megas a menos de uno.
LADO_MAXIMO = 1400

# Lo que el modelo espera: 320 x 320, normalizado con la media y la
# desviación de ImageNet, que es con lo que se entrenó.
LADO_MODELO = 320
MEDIA = (0.485, 0.456, 0.406)
DESVIACION = (0.229, 0.224, 0.225)

# Una sesión por modelo, cargada la primera vez que se pide. Son unos
# segundos y 176 MB en memoria cada una, así que no se cargan las dos si
# solo se usa una. El cerrojo evita cargarla dos veces si llegan dos
# recortes a la vez, que ahora corren en hilos.
_sesiones = {}
_cerrojo = threading.Lock()


# ── Dónde están los modelos ───────────────────────────────────────

def _carpeta_del_programa() -> Path | None:
    """La carpeta de modelos del programa instalado, si lo está.

    El backend congelado vive en {app}\\backend y los modelos van un nivel
    más arriba, junto al lanzador, en {app}\\modelos.
    """
    if not getattr(sys, "frozen", False):
        return None
    aqui = Path(sys.executable).resolve().parent
    app = aqui.parent if aqui.name.lower() == "backend" else aqui
    return app / "modelos"


def carpetas_de_modelos() -> list[Path]:
    """Dónde se busca cada modelo, en este orden."""
    carpetas = []

    propia = os.environ.get("RCS_MODELOS")
    if propia:
        carpetas.append(Path(propia))

    programa = _carpeta_del_programa()
    if programa is not None:
        carpetas.append(programa)

    # La caché de rembg: en un equipo donde ya se usó, los modelos están
    # ahí y no hay por qué bajarlos otra vez.
    xdg = os.environ.get("XDG_DATA_HOME")
    rembg = os.environ.get("REMBG_HOME") or (
        str(Path(xdg) / "rembg") if xdg else str(Path.home() / ".rembg"))
    carpetas.append(Path(rembg).expanduser() / "models")
    carpetas.append(Path(os.environ.get("U2NET_HOME") or Path.home() / ".u2net").expanduser())

    return carpetas


def ruta_modelo(nombre: str) -> Path | None:
    """El archivo del modelo, si está en alguna de las carpetas.

    Se acepta tanto plano (u2net.onnx) como en su subcarpeta
    (u2net/u2net.onnx), que es como lo deja rembg.
    """
    for carpeta in carpetas_de_modelos():
        for candidato in (carpeta / f"{nombre}.onnx", carpeta / nombre / f"{nombre}.onnx"):
            if candidato.is_file():
                return candidato
    return None


def _descargar(nombre: str) -> Path:
    """Baja el modelo a la caché de rembg y comprueba su huella."""
    url, md5 = DESCARGAS[nombre]
    destino = carpetas_de_modelos()[-2] / nombre / f"{nombre}.onnx"
    destino.parent.mkdir(parents=True, exist_ok=True)

    # A un temporal y luego se renombra: si la descarga se corta, no queda
    # en su sitio un modelo a medias que la próxima vez se cargaría.
    fd, temporal = tempfile.mkstemp(dir=destino.parent, suffix=".parcial")
    huella = hashlib.md5()
    try:
        with os.fdopen(fd, "wb") as archivo, urllib.request.urlopen(url, timeout=120) as r:
            while True:
                bloque = r.read(1 << 20)
                if not bloque:
                    break
                huella.update(bloque)
                archivo.write(bloque)

        if huella.hexdigest() != md5:
            raise ValueError(f"el modelo {nombre} se descargó dañado")

        os.replace(temporal, destino)
    finally:
        if os.path.exists(temporal):
            os.unlink(temporal)

    return destino


def _sesion(nombre: str, descargar: bool = True):
    with _cerrojo:
        if nombre in _sesiones:
            return _sesiones[nombre]

        ruta = ruta_modelo(nombre)
        if ruta is None:
            if not descargar:
                buscado = ", ".join(str(c) for c in carpetas_de_modelos())
                raise FileNotFoundError(f"falta el modelo {nombre} (buscado en {buscado})")
            ruta = _descargar(nombre)

        import onnxruntime as ort

        _sesiones[nombre] = ort.InferenceSession(
            str(ruta), providers=["CPUExecutionProvider"])
        return _sesiones[nombre]


# ── El recorte ────────────────────────────────────────────────────

def _entrada(sesion, imagen: Image.Image) -> dict:
    """La imagen como la espera el modelo. Igual que la preparaba rembg."""
    reducida = imagen.convert("RGB").resize((LADO_MODELO, LADO_MODELO), Image.Resampling.LANCZOS)
    matriz = np.array(reducida)
    matriz = matriz / max(np.max(matriz), 1e-6)

    tensor = np.zeros((matriz.shape[0], matriz.shape[1], 3))
    for canal in range(3):
        tensor[:, :, canal] = (matriz[:, :, canal] - MEDIA[canal]) / DESVIACION[canal]

    tensor = tensor.transpose((2, 0, 1))
    return {sesion.get_inputs()[0].name: np.expand_dims(tensor, 0).astype(np.float32)}


def mascara(imagen: Image.Image, nombre: str, descargar: bool = True) -> Image.Image:
    """La máscara del sujeto, del tamaño de la imagen: blanco es sujeto."""
    sesion = _sesion(nombre, descargar)
    salida = sesion.run(None, _entrada(sesion, imagen))

    prediccion = salida[0][:, 0, :, :]
    maximo, minimo = np.max(prediccion), np.min(prediccion)

    # Una imagen lisa daría una predicción plana, y dividir por cero dejaría
    # la máscara llena de NaN. Sin nada que distinguir, no hay sujeto.
    if maximo == minimo:
        prediccion = np.zeros_like(prediccion)
    else:
        prediccion = (prediccion - minimo) / (maximo - minimo)

    prediccion = np.squeeze(prediccion).clip(0, 1)
    resultado = Image.fromarray((prediccion * 255).astype("uint8"))
    return resultado.resize(imagen.size, Image.Resampling.LANCZOS)


def quitar_fondo(contenido: bytes, sujeto: str = "persona") -> bytes:
    """Devuelve la foto en PNG con el fondo transparente.

    Se normaliza la orientación antes de recortar. Las fotos de móvil
    traen la rotación en los datos EXIF en vez de en los píxeles, y el PNG
    de salida no lleva EXIF: sin enderezarla primero, un retrato tomado en
    vertical se guardaría tumbado para siempre.
    """
    imagen = Image.open(io.BytesIO(contenido))
    imagen = ImageOps.exif_transpose(imagen)

    if max(imagen.size) > LADO_MAXIMO:
        imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)

    rgb = imagen.convert("RGB")
    sujeto_mascara = mascara(rgb, MODELOS.get(sujeto, MODELOS["persona"]))

    # El sujeto sobre un lienzo transparente, con la máscara como alfa.
    recortada = Image.composite(rgb, Image.new("RGBA", rgb.size, 0), sujeto_mascara)

    salida = io.BytesIO()
    recortada.save(salida, format="PNG", optimize=True)
    return salida.getvalue()


def comprobar(descargar: bool = False) -> dict:
    """Carga los dos modelos y recorta una imagen de prueba.

    Para el diagnóstico y para comprobar un paquete antes de publicarlo.
    Sin descarga por defecto: lo que se comprueba es que los modelos
    viajan con el programa, no que haya internet.
    """
    prueba = Image.new("RGB", (64, 64), (40, 40, 40))
    prueba.paste((220, 30, 30), (16, 16, 48, 48))

    informe = {}
    for sujeto, nombre in MODELOS.items():
        mascara(prueba, nombre, descargar)
        informe[sujeto] = str(ruta_modelo(nombre))
    return informe


# ── Logotipos ─────────────────────────────────────────────────────
#
# Un logo no se recorta con los modelos de arriba. Estan entrenados con
# fotografias de personas y de objetos, y delante de unas letras con
# destellos no saben que es figura y que es fondo: devuelven cualquier
# cosa o la imagen entera.
#
# Lo que sirve es quitar el fondo por color. Los logos vienen sobre un
# plano uniforme —casi siempre negro o blanco— y ese plano se puede
# reconocer mirando las esquinas.

# Hasta donde se considera fondo. Por debajo el pixel se va del todo, y
# entre este valor y el doble se difumina: sin esa franja el borde de las
# letras queda dentado.
TOLERANCIA = 42


def _color_del_fondo(imagen):
    """El color de las cuatro esquinas, si coinciden entre si.

    Se miran las esquinas y no un pixel suelto: una mota o el filo de un
    destello darian un color equivocado para toda la imagen.
    """
    ancho, alto = imagen.size
    m = max(2, min(ancho, alto) // 40)

    esquinas = []
    for x0, y0 in ((0, 0), (ancho - m, 0), (0, alto - m), (ancho - m, alto - m)):
        trozo = imagen.crop((x0, y0, x0 + m, y0 + m))
        pixeles = list(trozo.getdata())
        esquinas.append(tuple(sum(c[i] for c in pixeles) // len(pixeles)
                              for i in range(3)))

    # Si las esquinas no se parecen, el fondo no es plano y esto no aplica.
    for c in esquinas[1:]:
        if sum(abs(a - b) for a, b in zip(c, esquinas[0])) > TOLERANCIA * 3:
            return None

    return tuple(sum(c[i] for c in esquinas) // 4 for i in range(3))


def quitar_fondo_plano(contenido: bytes, tolerancia: int = TOLERANCIA) -> bytes:
    """Deja transparente el fondo plano de un logotipo.

    Devuelve PNG. Si el fondo no es plano se levanta un error en vez de
    devolver una imagen destrozada: es mejor decirlo que entregar un logo
    con agujeros.
    """
    imagen = Image.open(io.BytesIO(contenido))
    imagen = ImageOps.exif_transpose(imagen).convert("RGBA")

    fondo = _color_del_fondo(imagen.convert("RGB"))
    if fondo is None:
        raise ValueError(
            "El fondo no es de un solo color: este recorte solo sirve para "
            "logos sobre un plano uniforme"
        )

    fr, fg, fb = fondo
    pixeles = imagen.load()
    ancho, alto = imagen.size

    for y in range(alto):
        for x in range(ancho):
            r, g, b, a = pixeles[x, y]
            if a == 0:
                continue

            # Distancia al color del fondo. Se difumina en una franja para
            # que el filo de las letras no quede dentado.
            d = abs(r - fr) + abs(g - fg) + abs(b - fb)
            if d <= tolerancia:
                pixeles[x, y] = (r, g, b, 0)
            elif d <= tolerancia * 2:
                suave = int(255 * (d - tolerancia) / tolerancia)
                pixeles[x, y] = (r, g, b, min(a, suave))

    salida = io.BytesIO()
    imagen.save(salida, format="PNG", optimize=True)
    return salida.getvalue()
