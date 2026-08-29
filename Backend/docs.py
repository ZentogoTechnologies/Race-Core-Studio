# Dentro de tu archivo docs.py

tags_metadata = [
    {
        "name": "Pilots",
        "description": "Operaciones para gestionar a los pilotos, incluyendo creación, modificación y soft delete.",
    },
    {
        "name": "Vehicles",
        "description": "Gestión del CRUD completo de los autos de competencia.",
    },
    {
        "name": "Categories",
        "description": "Manejo de las jerarquías de categorías de circuito (GT Challenge, TCR, etc.).",
    },
    {
        "name": "Events",
        "description": "Creación de eventos, qualys, heats y generación de la grilla de salida.",
    },
    {
        "name": "Users",
        "description": "Gestión del CRUD completo de los usuarios del sistema.",
    },
    {
        "name": "Auth",
        "description": "Inicio de sesión y validación del token. Devuelve el JWT que exige el resto del API.",
    },
    {
        "name": "Timing",
        "description": "Clasificación en vivo leída del current.xml de MyLaps, cruzada con los pilotos de la base.",
    },
    {
        "name": "Graphics",
        "description": "Envío de gráficos al servidor CasparCG por AMCP: sacar al aire, actualizar datos y limpiar capas.",
    }
]