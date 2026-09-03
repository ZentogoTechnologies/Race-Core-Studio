from typing import Optional

from beanie import Document


class Ajustes(Document):
    """Configuración que se cambia en caliente desde la interfaz.

    Documento único: siempre se lee y escribe el primero que haya. Lo que
    vive en el .env son valores de instalación (puertos, credenciales) que
    no tiene sentido tocar sin reiniciar; esto es lo que cambia durante un
    fin de semana de carrera.
    """

    # Sobrescribe TIMING_XML_PATH del .env cuando está puesta. En None se
    # usa la del .env, que sigue siendo el valor por defecto.
    timing_xml_path: Optional[str] = None

    # Nombre del archivo que subió el cliente para su logo. El archivo en
    # sí siempre se escribe en el mismo sitio, así que esto solo sirve para
    # saber si hay uno puesto y poder mostrarlo en la interfaz.
    client_logo: Optional[str] = None

    # Cuál de las tipografías empaquetadas usan los gráficos. El archivo
    # que leen las plantillas se reescribe al elegirla; esto es para saber
    # cuál está puesta sin tener que leer el CSS.
    font_graficos: Optional[str] = None

    # En qué idioma salen la interfaz y los rótulos de los gráficos. Los
    # datos —nombres, equipos, marcas— no se traducen: son nombres propios.
    idioma: Optional[str] = None

    class Settings:
        name = "ajustes"
