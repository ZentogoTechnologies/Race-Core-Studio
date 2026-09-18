from fastapi import APIRouter, HTTPException, Query

from src.services.weather_services import obtener_clima

weather = APIRouter()


@weather.get("/", tags=["Weather"])
async def clima(
    forzar: bool = Query(False, description="Ignora la caché y vuelve a consultar"),
):
    """
    Clima actual en el autódromo configurado (WEATHER_* en .env).

    Si el servicio no responde se devuelve el último dato conocido con
    `obsoleto: true`: al aire vale más un dato de hace un rato que un hueco
    """
    from src.services.settings_services import idioma_actual

    datos = obtener_clima(forzar=forzar, idioma=await idioma_actual())

    # Solo se falla cuando no hay absolutamente nada que mostrar.
    if not datos.get("ok"):
        raise HTTPException(status_code=503, detail=datos.get("error", "Clima no disponible"))

    return datos
