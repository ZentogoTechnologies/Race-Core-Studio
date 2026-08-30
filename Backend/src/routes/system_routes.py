import asyncio

from fastapi import APIRouter, Depends

from src.models.users_model import User
from src.services.auth_services import puede_escribir
from src.services.system_services import apagar_backend, detener_servicios

# Apagar el sistema entero en plena carrera es demasiado destructivo para
# un usuario estándar, que hoy puede operar gráficos pero no escribir en
# la base. Queda en manos de owner y admin.
system = APIRouter(dependencies=[Depends(puede_escribir)])


@system.post("/shutdown", tags=["System"])
async def apagar(usuario: User = Depends(puede_escribir)):
    """
    Detiene CasparCG, el frontend y el backend. MongoDB no se toca.

    Responde antes de apagarse: el backend se cierra a sí mismo un
    instante después, para que el navegador alcance a recibir el resumen
    en vez de una conexión cortada.
    """
    resultados = detener_servicios()

    # Se programa en vez de esperarse: si se hiciera aquí, el proceso
    # moriría antes de devolver la respuesta.
    asyncio.create_task(apagar_backend())

    resultados.append({
        "servicio": "Backend",
        "puerto": 8080,
        "estado": "deteniendo",
        "detalle": "se cierra en un instante",
    })

    return {
        "ok": True,
        "solicitado_por": usuario.username,
        "servicios": resultados,
        "nota": "MongoDB sigue corriendo: es un servicio de Windows.",
    }
