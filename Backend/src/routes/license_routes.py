"""Licencia: consultar el estado y activar.

La política de acceso de este router no es uniforme, y conviene ver por
qué antes de tocarla:

  · `/salud` va abierta. La consultan el servicio de vigilancia y la
    pantalla de bloqueo, que corren fuera del panel y no tienen sesión.
    Solo dice si se puede operar; ni el cliente ni las fechas salen ahí.

  · `/estado` y `/equipo` piden sesión: llevan nombre, correo y plan del
    cliente, que no tienen por qué ser públicos.

  · `/rcslic` y `/activar` son del dueño. Cambiar la licencia de un
    equipo es una decisión de negocio, no de operación. `/rcslic` es la
    de ahora (el archivo de rcs.zentogotech.com); `/activar` sigue para
    los equipos que se instalaron con el token antiguo.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from src.models.users_model import User
from src.schemas.license_schemas import (
    ActivarLicencia,
    EstadoLicencia,
    Equipo,
    SaludLicencia,
)
from src.services.auth_services import solo_owner, usuario_actual
from src.services.fingerprint_services import huella_equipo
from src.services import license_services as lic

license = APIRouter()


@license.get("/salud", response_model=SaludLicencia, tags=["License"])
async def salud():
    """¿Se puede operar? Sin sesión y sin datos del cliente."""
    estado = lic.estado_licencia()
    return SaludLicencia(estado=estado.estado.value, opera=estado.opera)


@license.get("/estado", response_model=EstadoLicencia, tags=["License"])
async def estado(_: User = Depends(usuario_actual)):
    """El detalle completo, para el panel."""
    return EstadoLicencia(**lic.estado_licencia(refrescar=True).resumen())


@license.get("/equipo", response_model=Equipo, tags=["License"])
async def equipo(_: User = Depends(usuario_actual)):
    """La huella de esta máquina.

    Es lo que hay que darle a Zentogo para que emita la licencia, o para
    que la reasigne cuando el cliente cambia de computadora.
    """
    return Equipo(huella=huella_equipo(), producto=lic.PRODUCTO)


@license.post("/rcslic", response_model=EstadoLicencia, tags=["License"])
async def cargar_rcslic(archivo: UploadFile = File(...), _: User = Depends(solo_owner)):
    """Carga un .rcslic nuevo: la renovación, sin reinstalar.

    Lo activa contra el servidor de Zentogo, así que necesita internet.
    Si no hay conexión o el servidor lo rechaza, la licencia que había se
    queda como estaba y se contesta 400 con el motivo.
    """
    contenido = await archivo.read()
    try:
        # La llamada al servidor tarda hasta 40 s si la red no responde;
        # fuera del bucle de eventos para no congelar el resto del panel.
        resultado = await run_in_threadpool(lic.instalar_rcslic, contenido, archivo.filename or "")
    except lic.RenovacionFallida as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return EstadoLicencia(**resultado.resumen())


@license.post("/activar", response_model=EstadoLicencia, tags=["License"])
async def activar(datos: ActivarLicencia, _: User = Depends(solo_owner)):
    """Instala un token de licencia en este equipo.

    Se rechaza con 400 y el motivo exacto si no sirve —otro equipo, otro
    producto, firma inválida, ya expirada—. Un mensaje genérico obligaría
    al cliente a llamar a soporte para saber qué pasó.
    """
    resultado = lic.guardar_licencia(datos.token.strip())

    if not resultado.opera:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=resultado.mensaje or "La licencia no es válida para este equipo.",
        )

    return EstadoLicencia(**resultado.resumen())
