"""
Cliente AMCP para CasparCG.

AMCP es un protocolo de texto sobre TCP: se manda una línea terminada en
CRLF y el servidor contesta con una línea de estado (`202 CG OK`,
`400 ERROR`, etc.) seguida, según el código, de líneas de datos.

Se mantiene una sola conexión persistente protegida por un lock, porque
durante una transmisión los comandos llegan seguidos y abrir un socket
por cada uno agrega latencia innecesaria.
"""

import asyncio
import logging

from config import settings

logger = logging.getLogger(__name__)


class CasparCGError(Exception):
    """El servidor recibió el comando pero lo rechazó (códigos 4xx / 5xx)."""

    def __init__(self, code: int, status: str, command: str):
        self.code = code
        self.status = status
        self.command = command
        super().__init__(f"CasparCG respondió '{status}' al comando: {command}")


class CasparCGUnavailable(Exception):
    """No se pudo hablar con el servidor (apagado, red caída, timeout)."""


class CasparCGClient:
    def __init__(
        self,
        host: str = None,
        port: int = None,
        timeout: float = None,
    ):
        self.host = host or settings.CASPARCG_HOST
        self.port = port or settings.CASPARCG_PORT
        self.timeout = timeout or settings.CASPARCG_TIMEOUT

        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._lock = asyncio.Lock()

    # ── Conexión ──────────────────────────────────────────────

    @property
    def is_connected(self) -> bool:
        return self._writer is not None and not self._writer.is_closing()

    async def _connect(self) -> None:
        try:
            self._reader, self._writer = await asyncio.wait_for(
                # 4 MB: el XML de INFO de un canal cargado supera de sobra
                # el límite de 64 KB que asyncio usa por defecto.
                asyncio.open_connection(self.host, self.port, limit=4 * 1024 * 1024),
                timeout=self.timeout,
            )
            logger.info("Conectado a CasparCG en %s:%s", self.host, self.port)
        except (OSError, asyncio.TimeoutError) as exc:
            self._reader = self._writer = None
            raise CasparCGUnavailable(
                f"No se pudo conectar a CasparCG en {self.host}:{self.port} ({exc})"
            ) from exc

    async def _drop(self) -> None:
        """Cierra la conexión sin propagar errores del cierre."""
        writer, self._writer, self._reader = self._writer, None, None
        if writer is None:
            return
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

    async def reconectar(self) -> dict:
        """Tira la conexión y la vuelve a abrir.

        El cliente ya reconecta solo cuando el socket se cae, pero eso
        ocurre al mandar el siguiente comando y no antes. Cerrando y
        volviendo a abrir CasparCG se queda una conexión que parece viva y
        no lo está; esto la fuerza sin tener que reiniciar el backend.
        """
        async with self._lock:
            await self._drop()

            try:
                await self._connect()
            except CasparCGUnavailable as exc:
                return {"ok": False, "detalle": str(exc)}

            # No basta con que el socket abra: se pregunta algo para saber
            # que del otro lado hay un CasparCG y no otra cosa.
            try:
                codigo, estado, _ = await self._send_once("VERSION")
            except Exception as exc:
                await self._drop()
                return {"ok": False, "detalle": f"El puerto abre pero no responde AMCP ({exc})"}

            return {"ok": True, "detalle": estado, "codigo": codigo}

    async def close(self) -> None:
        async with self._lock:
            await self._drop()

    # ── Lectura de la respuesta ───────────────────────────────

    async def _read_line(self) -> str:
        # AMCP delimita con CRLF, no con LF. La respuesta de INFO es un XML
        # que cuenta como una sola línea pero por dentro lleva saltos \n:
        # con readline() se partiría y dejaría el socket desincronizado.
        try:
            raw = await asyncio.wait_for(
                self._reader.readuntil(b"\r\n"), timeout=self.timeout
            )
        except asyncio.LimitOverrunError as exc:
            raise ConnectionError(
                f"Respuesta de CasparCG mayor que el buffer: {exc}"
            ) from exc
        if not raw:
            raise ConnectionError("CasparCG cerró la conexión")
        return raw.decode("utf-8", errors="replace").rstrip("\r\n")

    async def _read_response(self) -> tuple[int, str, list[str]]:
        status = await self._read_line()

        head = status.split(" ", 1)[0]
        code = int(head) if head.isdigit() else 0

        data: list[str] = []

        if code == 200:
            # Varias líneas de datos hasta una línea vacía.
            while True:
                line = await self._read_line()
                if line == "":
                    break
                data.append(line)

        elif code in (201, 400):
            # Exactamente una línea más.
            data.append(await self._read_line())

        return code, status, data

    # ── Envío ─────────────────────────────────────────────────

    async def _send_once(self, command: str) -> tuple[int, str, list[str]]:
        self._writer.write((command + "\r\n").encode("utf-8"))
        await self._writer.drain()
        return await self._read_response()

    async def send(self, command: str) -> dict:
        """
        Manda un comando AMCP y espera la respuesta del servidor.

        Devuelve {"command", "code", "status", "data"}.
        Lanza CasparCGUnavailable si el servidor no responde y
        CasparCGError si responde con un código de error.
        """
        command = command.strip()

        async with self._lock:
            if not self.is_connected:
                await self._connect()

            try:
                code, status, data = await self._send_once(command)

            except (OSError, ConnectionError, asyncio.IncompleteReadError):
                # La conexión se cayó entre comandos: reconecta y reintenta
                # una sola vez antes de darla por perdida.
                await self._drop()
                await self._connect()
                try:
                    code, status, data = await self._send_once(command)
                except (OSError, ConnectionError, asyncio.IncompleteReadError) as exc:
                    await self._drop()
                    raise CasparCGUnavailable(
                        f"Se perdió la conexión con CasparCG ({exc})"
                    ) from exc

            except asyncio.TimeoutError as exc:
                # Un timeout deja el socket desincronizado: mejor descartarlo.
                await self._drop()
                raise CasparCGUnavailable(
                    f"CasparCG no respondió en {self.timeout}s al comando: {command}"
                ) from exc

        if code >= 400 or code == 0:
            raise CasparCGError(code, status, command)

        return {"command": command, "code": code, "status": status, "data": data}


# Instancia única compartida por toda la aplicación.
casparcg = CasparCGClient()
