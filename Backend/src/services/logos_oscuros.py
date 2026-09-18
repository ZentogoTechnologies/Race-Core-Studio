"""
LOGOS DE MARCA PARA FONDO OSCURO

Los gráficos ponen el logo de la marca directamente sobre la caja oscura de
la carta, la grilla o los resultados. Los logos que son negros —Acura,
Cupra, Suzuki— o que traen el nombre en gris oscuro —Aston Martin,
Chevrolet, Renault— desaparecían sobre ese fondo. Una placa blanca detrás
lo resolvía, pero desentonaba con el resto del arte.

Así que a los gráficos se les sirve una versión del logo pensada para fondo
oscuro, con la misma regla para todas las marcas:

  - se buscan las zonas conectadas de píxeles neutros oscuros (negro, gris);
  - una zona que se apoya en el fondo transparente y no tiene detalles
    dentro es tinta suelta —letras, la A de Acura, la S de Suzuki— y se le
    invierte la luminosidad para que salga clara;
  - una zona que es el fondo de otros detalles —el círculo de Lotus con sus
    letras, el escudo de Lamborghini con el toro, el aro de BMW— o un hueco
    encerrado entre letras blancas se deja como está: lo que lleva encima
    ya se ve;
  - los colores no se tocan nunca.

El original no se modifica: el panel lo sigue mostrando tal cual, sobre su
baldosa blanca. La versión oscura se guarda en `public/marcas/oscuro/` y se
rehace sola si el original cambia.
"""

import colorsys
import threading
from collections import deque
from pathlib import Path

from PIL import Image

# Al aire el logo no pasa de ~120 px: 400 sobra y mantiene rápido el cálculo.
LADO = 400

SAT_NEUTRA = 0.25
L_OSCURO = 0.38
PROPORCION_DETALLE = 0.12
MIN_PIXELES = 6

SUBCARPETA = "oscuro"

_candado = threading.Lock()


def _clasificar(r, g, b, a):
    """0 transparente, 1 oscuro neutro, 2 detalle (claro o de color), 3 otro."""
    if a < 40:
        return 0
    _, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    neutro = s < SAT_NEUTRA or max(r, g, b) < 50
    if neutro and l < L_OSCURO:
        return 1
    if (neutro and l > 0.62) or (not neutro and l > 0.2):
        return 2
    return 3


def version_oscura(imagen: Image.Image) -> Image.Image:
    """La versión del logo para fondo oscuro, según la regla de arriba."""
    im = imagen.convert("RGBA")
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    w, h = im.size
    px = im.load()

    clase = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            clase[y * w + x] = _clasificar(*px[x, y])

    # Suma acumulada de detalles: cuántos hay en un recuadro, sin recorrerlo.
    acum = [[0] * (w + 1) for _ in range(h + 1)]
    for y in range(h):
        fila = 0
        for x in range(w):
            fila += 1 if clase[y * w + x] == 2 else 0
            acum[y + 1][x + 1] = acum[y][x + 1] + fila

    def detalles(x0, y0, x1, y1):
        return acum[y1 + 1][x1 + 1] - acum[y0][x1 + 1] - acum[y1 + 1][x0] + acum[y0][x0]

    visto = bytearray(w * h)
    for inicio in range(w * h):
        if clase[inicio] != 1 or visto[inicio]:
            continue

        cola = deque([inicio])
        visto[inicio] = 1
        zona = []
        x0 = y0 = 10 ** 9
        x1 = y1 = -1
        while cola:
            i = cola.popleft()
            zona.append(i)
            x, y = i % w, i // w
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not visto[j] and clase[j] == 1:
                            visto[j] = 1
                            cola.append(j)

        if len(zona) < MIN_PIXELES:
            continue

        # Tinta suelta es la que se apoya en lo transparente; un hueco
        # oscuro encerrado entre letras blancas (la I de MINI) no lo toca.
        miembros = set(zona)
        toca_transparente = False
        borde = set()
        for i in zona:
            x, y = i % w, i // w
            for dx in (-2, -1, 0, 1, 2):
                for dy in (-2, -1, 0, 1, 2):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if j in miembros:
                            continue
                        if abs(dx) <= 1 and abs(dy) <= 1 and clase[j] == 0:
                            toca_transparente = True
                        borde.add(j)
        if not toca_transparente:
            continue

        # El filo claro de la propia zona es antialias, no un detalle.
        filo = sum(1 for j in borde if clase[j] == 2)
        if detalles(x0, y0, x1, y1) - filo > PROPORCION_DETALLE * len(zona):
            continue

        for i in zona:
            x, y = i % w, i // w
            r, g, b, a = px[x, y]
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            nr, ng, nb = colorsys.hls_to_rgb(hh, 1 - ll, ss)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)

    return im


def ruta_oscura(original: Path) -> Path:
    return original.parent / SUBCARPETA / f"{original.stem}.png"


def asegurar(original: Path) -> Path | None:
    """La versión oscura del logo, generándola si falta o está vieja.

    Devuelve None si no se pudo hacer: quien llama sirve entonces el
    original, que es mejor que dejar el gráfico sin marca.
    """
    if not original.is_file() or original.name.startswith("_"):
        return None

    destino = ruta_oscura(original)
    try:
        if destino.is_file() and destino.stat().st_mtime >= original.stat().st_mtime:
            return destino

        with _candado:
            if destino.is_file() and destino.stat().st_mtime >= original.stat().st_mtime:
                return destino
            destino.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(original) as imagen:
                imagen.load()
                oscura = version_oscura(imagen)
            temporal = destino.with_suffix(".tmp.png")
            oscura.save(temporal, "PNG", optimize=True)
            temporal.replace(destino)
        return destino
    except Exception:
        return None


def generar_todas(carpeta: Path) -> int:
    """Prepara las versiones oscuras que falten. Se llama al arrancar."""
    hechas = 0
    if not carpeta.is_dir():
        return 0
    for archivo in sorted(carpeta.iterdir()):
        if archivo.is_file() and archivo.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") \
                and not archivo.name.startswith("_"):
            if asegurar(archivo):
                hechas += 1
    return hechas
