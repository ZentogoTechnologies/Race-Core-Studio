# Race Core Studio - Prototype 🏎️

Prototipo de Sistema de gestión para eventos de automovilismo. Soporta modos: **Drag** y **Circuito**.

## 🚀 Cómo ejecutar 

### Prerequisitos
- Node.js v18 o superior  
- npm v9 o superior

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor de desarrollo
npm run dev
```

Abre tu navegador en `http://localhost:5173`

> **Credenciales de acceso:** usuario `admin` / contraseña `admin`

---

## 📁 Estructura del proyecto

```
race-core-studio/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx                        ← Punto de entrada React
    ├── App.jsx                         ← Rutas / flujo de auth
    ├── index.css                       ← Tailwind + animaciones
    │
    ├── components/
    │   ├── auth/
    │   │   └── LoginScreen.jsx         ← Pantalla de login
    │   ├── events/
    │   │   └── EventSelectionScreen.jsx← Selección de modalidad
    │   ├── layout/
    │   │   └── NavItem.jsx             ← Ítem de navegación sidebar
    │   └── shared/
    │       └── ModuleHeader.jsx        ← Buscador + botón "Nuevo"
    │
    ├── layouts/
    │   └── MainLayout.jsx              ← Shell: sidebar + header + estado global
    │
    └── pages/
        ├── Home.jsx                    ← Dashboard con estadísticas
        ├── Eventos.jsx                 ← CRUD de eventos
        ├── Categorias.jsx              ← CRUD de categorías
        ├── Pilotos.jsx                 ← CRUD de pilotos
        └── Vehiculos.jsx              ← CRUD de vehículos
```

## 🛠️ Stack tecnológico

| Tecnología | Versión |
|-----------|---------|
| React | 18 |
| Vite | 5 |
| Tailwind CSS | 3 |
| lucide-react | 0.383 |
