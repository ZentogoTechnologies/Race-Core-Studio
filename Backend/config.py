from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Sin esto el archivo .env no se lee: los valores salian siempre
    # de los defaults de abajo o de variables de entorno sueltas.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MONGO_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "race-core-studio"

    # ── API ──────────────────────────────────────────────────
    # El 8000 lo reserva el media-server de CasparCG (ver casparcg.config),
    # por eso el backend vive en el 8080.
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8080

    # ── Archivos públicos ────────────────────────────────────
    # URL con la que CasparCG alcanza al backend para bajar las fotos
    # de los pilotos y los logos de las marcas. Tiene que ser absoluta:
    # la plantilla se carga desde file:// y no tiene contra qué resolver
    # una ruta relativa.
    PUBLIC_BASE_URL: str = "http://127.0.0.1:8080"

    # ── Cronometraje (MyLaps) ────────────────────────────────
    # Archivo que MyLaps reescribe constantemente con la clasificación.
    TIMING_XML_PATH: str = "W:/current.xml"

    # Segundos que se reutiliza la última lectura antes de volver al
    # disco. Con las plantillas preguntando cada medio segundo, sin esto
    # se leería el archivo de red decenas de veces por segundo.
    TIMING_CACHE_SECONDS: float = 0.4

    # ── CasparCG ──────────────────────────────────────────────
    # Servidor AMCP. Por defecto la misma máquina que el backend.
    CASPARCG_HOST: str = "127.0.0.1"
    CASPARCG_PORT: int = 5250

    # Canal sobre el que se grafica. Las capas salen del catálogo.
    CASPARCG_CHANNEL: int = 1

    # Segundos de espera al conectar y al leer la respuesta AMCP.
    CASPARCG_TIMEOUT: float = 5.0

    # ── Autenticación (JWT) ──────────────────────────────────
    # La firma sale del .env. Si alguien levanta el backend sin definirla
    # se usa este default, que sirve para desarrollo pero NO para salir al
    # aire: cualquiera que conozca la cadena puede firmarse un token.
    JWT_SECRET: str = "cambiar-esta-clave-en-produccion"
    JWT_ALGORITHM: str = "HS256"

    # 12 horas cubren un día completo de carrera sin obligar a volver a
    # entrar a media transmisión.
    JWT_EXPIRE_HOURS: int = 12

settings = Settings()
