# 🏁 Racing CasparCG Control System

Sistema avanzado de control para CasparCG desarrollado con Streamlit para gestionar overlays de carreras y eventos deportivos en tiempo real.

## 🚀 Características

### Tipos de Overlays Disponibles:
- **🌤️ Clima**: Temperatura ambiente, pista, humedad, viento, visibilidad con integración de APIs meteorológicas
- **🎤 Personal**: Narrador, comentarista, reportero, piloto con gestión de base de datos
- **🏆 Evento**: Información del gran premio, sesión, vueltas, tiempo
- **📱 Redes Sociales**: Twitter, Instagram, Facebook, YouTube
- **🏢 Sponsors**: Logos y mensajes promocionales con almacenamiento persistente
- **🏁 Circuito**: Información del trazado, récords, características
- **🚩 Banderas**: Control de banderas de carrera (Verde, Amarilla, Roja, Bandera a Cuadros)
- **⚡ Accesos Directos**: Panel de control rápido para funciones frecuentes

### Funcionalidades:
- ✅ Interfaz web intuitiva con Streamlit
- ✅ Conexión en tiempo real con CasparCG Server
- ✅ Templates HTML personalizables y dinámicos
- ✅ Control individual de cada overlay
- ✅ Configuración de duración automática
- ✅ Monitor del sistema en tiempo real
- ✅ Controles de emergencia
- ✅ Gestión de logos y archivos
- ✅ Base de datos SQLite integrada
- ✅ API de clima en tiempo real
- ✅ Sistema de banderas de carrera
- ✅ Panel de accesos directos
- ✅ Cacheo inteligente de recursos
- ✅ Arquitectura modular y escalable

## 📋 Requisitos

### Software Necesario:
- Python 3.8 o superior
- CasparCG Server 2.3.0 o superior
- Navegador web moderno

### Dependencias Python:
```
streamlit==1.47.0
requests==2.32.4
pillow==11.3.0
openmeteo-requests==1.5.0
openmeteo-sdk==1.20.1
pandas==2.3.1
numpy==2.3.1
requests-cache==1.2.1
GitPython==3.1.44
altair==5.5.0
```

## 🛠️ Instalación

### 1. Clonar o descargar el proyecto
```bash
# Si tienes git instalado
git clone <url-del-repositorio>
cd RacingApp

# O simplemente descargar y extraer el ZIP
```

### 2. Crear entorno virtual (recomendado)
```powershell
# En Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1

# En Command Prompt
python -m venv venv
venv\Scripts\activate.bat
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar Base de Datos
```bash
# La base de datos SQLite se inicializa automáticamente
# Los esquemas están definidos en db_schema.sql
```

### 5. Configurar CasparCG Server
Asegúrate de que CasparCG Server esté ejecutándose en:
- **Host**: localhost
- **Puerto**: 5250 (puerto AMCP por defecto)

## 🎮 Uso

### Ejecución Rápida
```bash
python run.py
```

### Ejecución Manual con Streamlit
```bash
streamlit run main.py
```

### Acceso a la Aplicación
Una vez iniciada, abre tu navegador en:
```
http://localhost:8501
```

## 🎛️ Guía de Uso

### 1. Configuración Inicial
1. Abre la aplicación en tu navegador
2. En la barra lateral, configura:
   - Host de CasparCG (por defecto: localhost)
   - Puerto (por defecto: 5250)
   - Canal de salida (por defecto: 1)
3. Haz clic en "🔄 Conectar"

### 2. Control de Overlays

#### Overlay de Clima 🌤️
- Configura temperatura ambiente y de pista
- Establece humedad, viento y visibilidad
- Selecciona condición climática
- Haz clic en "🌤️ Mostrar Clima"

#### Overlay de Personal 🎤
- Selecciona tipo: Narrador, Comentarista, Reportero, Piloto
- Introduce nombre y posición
- Configura equipo/canal
- Establece duración de visualización
- Haz clic en "🎤 Mostrar [Tipo]"

#### Overlay de Evento 🏆
- Configura nombre del evento y fecha
- Selecciona tipo de sesión
- Establece vuelta actual y total
- Configura tiempo restante
- Haz clic en "🏆 Mostrar Evento"

#### Overlay de Redes Sociales 📱
- Selecciona plataforma (Twitter, Instagram, Facebook, YouTube)
- Introduce usuario/handle y mensaje
- Agrega hashtags relevantes
- Configura tiempo de visualización
- Haz clic en "📱 Mostrar Redes"

#### Overlay de Sponsors 🏢
- Introduce nombre del sponsor
- Sube logo (PNG, JPG, JPEG)
- Selecciona posición en pantalla
- Configura animación y duración
- Haz clic en "🏢 Mostrar Sponsor"

#### Overlay de Banderas 🚩
- Selecciona tipo de bandera: Verde, Amarilla, Roja, Bandera a Cuadros
- Control inmediato para situaciones de carrera
- Animaciones específicas para cada tipo
- Posicionamiento automático en pantalla
- Haz clic en "🚩 Mostrar Bandera"

#### Panel de Accesos Directos ⚡
- Acceso rápido a funciones frecuentes
- Botones personalizables
- Configuraciones predefinidas
- Almacenamiento de preferencias en base de datos

#### Overlay de Circuito 🏁
- Introduce nombre del circuito
- Configura longitud y número de curvas
- Establece récord de vuelta y poseedor
- Configura zonas DRS
- Haz clic en "🏁 Mostrar Circuito"

### 3. Gestión de Base de Datos
- Ve a la pestaña "🗄️ Base de Datos"
- Administra personal, sponsors y eventos
- Visualiza estadísticas y logs
- Realiza copias de seguridad

### 4. Panel de Accesos Directos
- Ve a la pestaña "⚡ Shortcuts"
- Configura botones de acceso rápido
- Personaliza funciones frecuentes
- Guarda configuraciones personalizadas

### 5. Gestión de Templates
- Ve a la pestaña "🎨 Templates"
- Selecciona template a editar
- Modifica configuraciones globales
- Guarda cambios

### 6. Monitoreo del Sistema
- Ve a la pestaña "📊 Monitor"
- Observa métricas del sistema
- Revisa log de actividad
- Usa controles de emergencia si es necesario

## ⚙️ Configuración Avanzada

### Personalización de Templates
Los templates HTML están en la carpeta `templates/`. Puedes modificar:
- Estilos CSS
- Animaciones
- Posicionamiento
- Colores y fuentes

### Configuración de Layers
Edita `config.py` para cambiar:
```python
OVERLAY_LAYERS = {
    "climate": 100,
    "personnel": 101,
    "event": 102,
    "social": 103,
    "sponsor": 104,
    "circuit": 105,
    "flags": 106,
    "emergency": 110
}
```

### Base de Datos SQLite
La aplicación utiliza SQLite para:
- Almacenar información de personal
- Gestionar sponsors y logos
- Registrar eventos y configuraciones
- Mantener logs de actividad
- Cachear datos de clima

### API de Clima
Integración con OpenMeteo para:
- Datos meteorológicos en tiempo real
- Pronósticos actualizados
- Cacheo inteligente de consultas
- Configuración de ubicación personalizada

### Logos y Archivos
- Los logos se guardan en `logos/`
- Archivos temporales en `uploads/`
- Configuraciones en `config/`
- Base de datos en `db.sqlite3`
- Cache en `.cache.sqlite`

## 🚨 Solución de Problemas

### CasparCG no se conecta
1. Verifica que CasparCG Server esté ejecutándose
2. Confirma que el puerto 5250 esté disponible
3. Revisa la configuración del servidor
4. Verifica que no haya firewall bloqueando la conexión

### Overlays no aparecen
1. Verifica la conexión con CasparCG
2. Confirma que el canal esté configurado correctamente
3. Revisa que los templates estén en la carpeta correcta
4. Verifica los layers configurados

### Base de datos no responde
1. Verifica que `db.sqlite3` tenga permisos de escritura
2. Ejecuta `python db.py` para reinicializar
3. Revisa el esquema en `db_schema.sql`
4. Verifica que no haya procesos bloqueando el archivo

### API de clima no funciona
1. Verifica la conexión a internet
2. Revisa la configuración de ubicación
3. Consulta los logs de cache en `.cache.sqlite`
4. Reinicia la aplicación si es necesario

### Error de dependencias
```bash
pip install --upgrade -r requirements.txt
```

### Puerto ocupado
Si el puerto 8501 está ocupado:
```bash
streamlit run main.py --server.port 8502
```

## 📁 Estructura del Proyecto

```
RacingApp/
├── main.py                 # Aplicación principal Streamlit
├── caspar_client.py        # Cliente para CasparCG
├── overlay_manager.py      # Gestor de overlays
├── config.py              # Configuraciones globales
├── db.py                  # Conexión y operaciones de base de datos
├── db_schema.sql          # Esquema de base de datos
├── db.sqlite3             # Base de datos SQLite
├── run.py                 # Script de ejecución
├── run.bat                # Script de ejecución para Windows
├── install.bat            # Script de instalación
├── requirements.txt       # Dependencias Python
├── README.md             # Este archivo
├── .cache.sqlite         # Cache de consultas API
├── .gitignore            # Archivos ignorados por Git
├── src/                  # Código fuente modularizado
│   ├── circuit.py        # Overlay de circuito
│   ├── events.py         # Overlay de eventos
│   ├── flags.py          # Overlay de banderas
│   ├── personal.py       # Overlay de personal
│   ├── social_media.py   # Overlay de redes sociales
│   ├── sponsor.py        # Overlay de sponsors
│   ├── weather.py        # Overlay de clima
│   ├── database/         # Módulos de base de datos
│   │   └── db.py         # Operaciones de base de datos
│   └── tabs/             # Pestañas de la interfaz
│       └── shortcuts.py  # Panel de accesos directos
├── api/                  # APIs externas
│   └── weather.py        # Cliente de API meteorológica
├── templates/            # Templates HTML
│   ├── climate_overlay.html
│   ├── personnel_overlay.html
│   ├── event_overlay.html
│   ├── social_overlay.html
│   ├── sponsor_overlay.html
│   └── circuit_overlay.html
├── caspagcg/            # Servidor CasparCG
├── logos/               # Logos de sponsors
├── uploads/             # Archivos temporales
├── config/              # Archivos de configuración
└── venv/               # Entorno virtual (si se crea)
```

## 🔧 Comandos Útiles

### Ejecutar en modo desarrollo
```bash
streamlit run main.py --server.runOnSave true
```

### Limpiar caché de aplicación
```bash
# Limpiar cache de Streamlit
streamlit cache clear

# Limpiar cache de API de clima
python -c "import os; os.remove('.cache.sqlite') if os.path.exists('.cache.sqlite') else None"
```

### Reinicializar base de datos
```bash
python db.py
```

### Ver logs de CasparCG
Revisa la consola de CasparCG Server para ver los comandos AMCP enviados.

## 🎨 Personalización

### Cambiar colores principales
Edita los archivos CSS en `templates/` y modifica:
```css
:root {
    --primary-color: #ff0000;
    --secondary-color: #ffffff;
    --accent-color: #ff6b35;
}
```

### Agregar nuevos overlays
1. Crea un nuevo template HTML en `templates/`
2. Crea el módulo correspondiente en `src/`
3. Agrega el método en `overlay_manager.py`
4. Añade la interfaz en `main.py`
5. Actualiza la configuración en `config.py`
6. Actualiza el esquema de base de datos si es necesario

### Integrar nuevas APIs
1. Crea el cliente en `api/`
2. Configura el cacheo en el cliente
3. Añade las credenciales en `config.py`
4. Implementa el manejo de errores

## 🤝 Contribuir

Para contribuir al proyecto:
1. Fork el repositorio
2. Crea una rama para tu feature
3. Haz commit de tus cambios
4. Push a la rama
5. Crea un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo LICENSE para detalles.

## 🆘 Soporte

Para soporte técnico:
- Abre un issue en el repositorio de GitHub
- Revisa la documentación de CasparCG Server
- Consulta la documentación oficial de Streamlit
- Verifica los logs en la consola de CasparCG
- Revisa la base de datos con herramientas SQLite

### Recursos Útiles:
- [Documentación CasparCG](https://github.com/CasparCG/help/wiki)
- [Streamlit Documentation](https://docs.streamlit.io/)
- [OpenMeteo API](https://open-meteo.com/en/docs)
- [SQLite Tutorial](https://www.sqlite.org/docs.html)

---

**Desarrollado con ❤️ para la comunidad de broadcasting y motorsport**

*Última actualización: Julio 2025*
