"""Genera las imágenes del asistente de Inno Setup a partir del logo.

    python tools/imagenes_instalador.py            # escribe los .bmp
    python tools/imagenes_instalador.py --png DIR  # y una copia en PNG para verlas

Salen cuatro archivos en installer/inno/, cada uno a 1x y a 2x: Inno
elige el que mejor cuadra con el escalado de la pantalla del cliente.

    marca-lateral      164 x 314   pantallas de bienvenida y final
    marca-cabecera      55 x  55   esquina de las pantallas intermedias

Se dibuja todo a 2x y la versión 1x sale de reducir esa, así las dos son
la misma imagen y no dos dibujos que se parecen.

El logo trae fondo propio (negro con textura) y, en la esquina, la marca
de agua del generador con el que se hizo. Por eso no se pega entero: se
recorta solo el rótulo y se le quita el negro, de modo que asienta sobre
el fondo de aquí sin dejar un rectángulo alrededor.

Necesita Pillow, y fontTools + brotli para leer la tipografía de los
gráficos, que en el repositorio solo está en .woff2.
"""

from __future__ import annotations

import argparse
import io
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
LOGO = RAIZ / "Backend" / "src" / "private" / "Logo.jpeg"
FUENTES = RAIZ / "Casparcg" / "template" / "fonts"
DESTINO = RAIZ / "installer" / "inno"

# El rótulo, sin la marca de agua de la esquina, y la rueda sola.
CAJA_ROTULO = (140, 180, 895, 460)
CAJA_RUEDA = (226, 318, 354, 446)

FONDO_ARRIBA = (24, 24, 27)
FONDO_ABAJO = (10, 10, 11)
ROJO = (226, 30, 38)
GRIS = (150, 150, 158)


def fuente(peso: int, tam: int) -> ImageFont.FreeTypeFont:
    """Chakra Petch, la tipografía elegida para los gráficos."""
    from fontTools.ttLib import TTFont

    f = TTFont(FUENTES / f"ChakraPetch-{peso}.woff2")
    f.flavor = None
    crudo = io.BytesIO()
    f.save(crudo)
    crudo.seek(0)
    return ImageFont.truetype(crudo, tam)


def sin_negro(img: Image.Image) -> Image.Image:
    """Vuelve transparente el fondo oscuro del logo, con borde suave."""
    img = img.convert("RGB")
    brillo = img.convert("L")
    # Lo que pasa de ~70 es rótulo; por debajo de ~35, fondo. Entre medias
    # una rampa, para que el borde de las letras no quede dentado.
    alfa = brillo.point(lambda v: 0 if v < 35 else 255 if v > 70 else int((v - 35) * 255 / 35))
    # El rojo oscuro del rótulo tiene poco brillo; se rescata por saturación.
    r, g, b = img.split()
    rojo = ImageChops.subtract(r, g).point(lambda v: 255 if v > 60 else v * 4)
    alfa = ImageChops.lighter(alfa, rojo)
    out = img.convert("RGBA")
    out.putalpha(alfa)
    return out


def fondo(ancho: int, alto: int) -> Image.Image:
    """Degradado oscuro con una trama de hexágonos apenas visible."""
    img = Image.new("RGB", (ancho, alto))
    d = ImageDraw.Draw(img)
    for y in range(alto):
        t = y / max(alto - 1, 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(FONDO_ARRIBA, FONDO_ABAJO))
        d.line([(0, y), (ancho, y)], fill=c)

    trama = Image.new("L", (ancho, alto), 0)
    dt = ImageDraw.Draw(trama)
    r = 9
    dx, dy = r * math.sqrt(3), r * 1.5
    fila = 0
    y = -r
    while y < alto + r:
        x = -r + (dx / 2 if fila % 2 else 0)
        while x < ancho + r:
            pts = [(x + r * math.cos(math.radians(60 * k + 30)),
                    y + r * math.sin(math.radians(60 * k + 30))) for k in range(6)]
            dt.polygon(pts, outline=14)
            x += dx
        y += dy
        fila += 1
    blanco = Image.new("RGB", (ancho, alto), (255, 255, 255))
    return Image.composite(blanco, img, trama)


def franjas(img: Image.Image, y0: int, escala: int) -> None:
    """Las líneas de velocidad rojas, en diagonal, como en el logo."""
    d = ImageDraw.Draw(img, "RGBA")
    ancho = img.width
    for i, (grosor, alfa) in enumerate(((5, 255), (2, 170), (1, 110))):
        dy = i * 9 * escala // 2
        d.line([(0, y0 + 26 * escala + dy), (ancho, y0 + dy)],
               fill=ROJO + (alfa,), width=grosor * escala // 2 or 1)


def centrar(d: ImageDraw.ImageDraw, ancho: int, y: int, texto: str,
            f: ImageFont.FreeTypeFont, color, espaciado: int = 0) -> None:
    letras = [f.getlength(c) for c in texto]
    total = sum(letras) + espaciado * (len(texto) - 1)
    x = (ancho - total) / 2
    for c, w in zip(texto, letras):
        d.text((x, y), c, font=f, fill=color)
        x += w + espaciado


def lateral(version: str) -> Image.Image:
    """164 x 314 a 2x."""
    e = 2
    W, H = 164 * e, 314 * e
    img = fondo(W, H)

    rotulo = sin_negro(Image.open(LOGO).crop(CAJA_ROTULO))
    ancho = W - 28 * e
    rotulo = rotulo.resize((ancho, round(rotulo.height * ancho / rotulo.width)), Image.LANCZOS)
    y_rotulo = 84 * e
    # Un halo rojo muy tenue detrás, para que el rótulo no flote.
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse(
        (W // 2 - 90 * e, y_rotulo - 10 * e, W // 2 + 90 * e, y_rotulo + rotulo.height + 20 * e),
        fill=ROJO + (40,))
    halo = halo.filter(ImageFilter.GaussianBlur(28 * e))
    img = Image.alpha_composite(img.convert("RGBA"), halo)
    img.alpha_composite(rotulo, ((W - ancho) // 2, y_rotulo))

    franjas(img, 190 * e, e)

    d = ImageDraw.Draw(img)
    # Sin palabras en un idioma: el asistente sale en español o en inglés
    # y la imagen es la misma para los dos.
    centrar(d, W, 222 * e, f"v{version}", fuente(700, 18 * e), (235, 235, 238), 2 * e)
    centrar(d, W, 290 * e, "ZENTOGO TECHNOLOGIES", fuente(600, 8 * e), GRIS, 1 * e)
    return img.convert("RGB")


def cabecera() -> Image.Image:
    """55 x 55 a 2x: la rueda del logo sobre el mismo fondo."""
    e = 2
    L = 55 * e
    img = fondo(L, L).convert("RGBA")
    rueda = sin_negro(Image.open(LOGO).crop(CAJA_RUEDA))
    lado = L - 10 * e
    rueda = rueda.resize((lado, lado), Image.LANCZOS)
    # Solo el círculo: en las esquinas del recorte asoma la franja roja
    # que en el logo pasa por detrás de la rueda.
    circulo = Image.new("L", (lado * 4, lado * 4), 0)
    ImageDraw.Draw(circulo).ellipse((6, 6, lado * 4 - 6, lado * 4 - 6), fill=255)
    circulo = circulo.resize((lado, lado), Image.LANCZOS)
    rueda.putalpha(ImageChops.multiply(rueda.getchannel("A"), circulo))
    img.alpha_composite(rueda, ((L - lado) // 2, (L - lado) // 2))
    return img.convert("RGB")


def guardar(img: Image.Image, nombre: str, png: Path | None) -> None:
    for sufijo, im in (("@2x", img),
                       ("", img.resize((img.width // 2, img.height // 2), Image.LANCZOS))):
        im.save(DESTINO / f"{nombre}{sufijo}.bmp")
        if png:
            im.save(png / f"{nombre}{sufijo}.png")
        print(f"  {nombre}{sufijo}.bmp  {im.width} x {im.height}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--png", type=Path, help="carpeta donde dejar también una copia en PNG")
    a = p.parse_args()
    if a.png:
        a.png.mkdir(parents=True, exist_ok=True)

    version = (RAIZ / "VERSION").read_text(encoding="utf-8").strip()
    guardar(lateral(version), "marca-lateral", a.png)
    guardar(cabecera(), "marca-cabecera", a.png)


if __name__ == "__main__":
    main()
