# Archivos públicos

Todo lo que hay aquí lo sirve FastAPI en `/public`, y las plantillas de
CasparCG lo cargan por HTTP. El backend tiene que estar corriendo para
que las fotos y los logos aparezcan al aire.

## Fotos de pilotos — `pilotos/`

El archivo se nombra con el **pilot_id**, y la subcarpeta da igual: el
backend busca en todas. Sirve para tenerlas ordenadas por categoría.

    pilotos/prospec-series/1.png     -> Paola Castañedas (pilot_id 1)
    pilotos/super-turismo/19.jpg     -> Jose Nuñez (pilot_id 19)

Extensiones aceptadas: png, jpg, jpeg, webp, avif.
Recomendado: PNG con fondo transparente, recorte de medio cuerpo,
al menos 600 px de alto.

## Logos de marcas — `marcas/`

El archivo se nombra con la marca del vehículo tal como está en la base,
en minúsculas y con guiones en lugar de espacios.

    marcas/changan.png
    marcas/mini-cooper.png

Marcas que hoy existen en la base:
acura, bmw, changan, honda, hyundai, lotus, mazda, mini-cooper,
nissan, subaru, suzuki, toyota

## Si falta un archivo

Se manda `_sin-foto.png` / `_sin-logo.png`, que son transparentes. Así el
hueco queda vacío en vez de mostrar la foto del piloto anterior.
