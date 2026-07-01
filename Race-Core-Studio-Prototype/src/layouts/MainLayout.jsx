import { useState } from 'react'
import {
  Menu,
  X,
  Home,
  Users,
  Car,
  LogOut,
  Calendar,
  Tag,
  Map,
  Timer,
} from 'lucide-react'
import NavItem from '../components/layout/NavItem'
import HomeModule from '../pages/Home'
import EventosModule from '../pages/Eventos'
import CategoriasModule from '../pages/Categorias'
import PilotosModule from '../pages/Pilotos'
import VehiculosModule from '../pages/Vehiculos'

// ==========================================
// 📁 src/layouts/MainLayout.jsx
// ==========================================
export default function MainLayout({ eventType, onLogout, onChangeEvent }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeModule, setActiveModule] = useState('home')

  // --- ESTADOS GLOBALES DE DATOS (Simulando una base de datos) ---
  const [pilotos, setPilotos] = useState([
    { id: 1, nombre: 'Juan', apellido: 'Perez', sangre: 'O+' },
  ])
  const [vehiculos, setVehiculos] = useState([
    { id: 1, marca: 'Porsche', modelo: '911 GT3', equipo: 'Team Racing Panama' },
  ])
  const [categorias, setCategorias] = useState([
    {
      id: 1,
      nombre: 'Pro Mod',
      restricciones: 'Sin restricciones de motor',
      peso: '2500 lbs',
    },
  ])
  const [eventos, setEventos] = useState([
    {
      id: 1,
      nombre: 'Campeonato Nacional V1',
      fecha: '2026-08-15',
      ubicacion: 'Autódromo Principal',
      estado: 'Próximo',
    },
  ])

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return (
          <HomeModule
            eventType={eventType}
            stats={{
              p: pilotos.length,
              v: vehiculos.length,
              c: categorias.length,
              e: eventos.length,
            }}
            allData={{ eventos, categorias, pilotos, vehiculos }}
          />
        )
      case 'eventos':
        return <EventosModule eventos={eventos} setEventos={setEventos} />
      case 'categorias':
        return (
          <CategoriasModule categorias={categorias} setCategorias={setCategorias} />
        )
      case 'pilotos':
        return <PilotosModule pilotos={pilotos} setPilotos={setPilotos} />
      case 'vehiculos':
        return <VehiculosModule vehiculos={vehiculos} setVehiculos={setVehiculos} />
      default:
        return <HomeModule eventType={eventType} />
    }
  }

  const headerTitles = {
    home: 'Panel Principal',
    eventos: 'Gestión de Eventos',
    categorias: 'Gestión de Categorías',
    pilotos: 'Directorio de Pilotos',
    vehiculos: 'Directorio de Vehículos',
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside
        className={`bg-[#141414] border-r border-neutral-800 transition-all duration-300 flex flex-col z-20 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo / Toggle */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800">
          {isSidebarOpen && (
            <span className="text-lg font-black italic tracking-wide text-white whitespace-nowrap">
              RACE CORE <span className="text-red-600">STUDIO</span>
            </span>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white mx-auto"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          <NavItem
            icon={<Home />}
            label="Inicio"
            isActive={activeModule === 'home'}
            onClick={() => setActiveModule('home')}
            isOpen={isSidebarOpen}
          />
          <div className="my-2 border-t border-neutral-800" />
          <NavItem
            icon={<Calendar />}
            label="Eventos"
            isActive={activeModule === 'eventos'}
            onClick={() => setActiveModule('eventos')}
            isOpen={isSidebarOpen}
          />
          <NavItem
            icon={<Tag />}
            label="Categorías"
            isActive={activeModule === 'categorias'}
            onClick={() => setActiveModule('categorias')}
            isOpen={isSidebarOpen}
          />
          <NavItem
            icon={<Users />}
            label="Pilotos"
            isActive={activeModule === 'pilotos'}
            onClick={() => setActiveModule('pilotos')}
            isOpen={isSidebarOpen}
          />
          <NavItem
            icon={<Car />}
            label="Vehículos"
            isActive={activeModule === 'vehiculos'}
            onClick={() => setActiveModule('vehiculos')}
            isOpen={isSidebarOpen}
          />
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 space-y-2">
          <button
            onClick={onChangeEvent}
            className={`w-full flex items-center ${
              isSidebarOpen ? 'justify-start px-4' : 'justify-center'
            } py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors gap-3`}
          >
            <Map size={18} />
            {isSidebarOpen && (
              <span className="font-semibold text-sm">Cambiar Modo</span>
            )}
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex items-center ${
              isSidebarOpen ? 'justify-start px-4' : 'justify-center'
            } py-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors gap-3`}
          >
            <LogOut size={18} />
            {isSidebarOpen && (
              <span className="font-semibold text-sm">Cerrar Sesión</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Red accent bar top-right */}
        <div className="absolute top-0 right-0 w-64 h-2 bg-red-600 rounded-bl-3xl opacity-80 z-0" />

        {/* Header */}
        <header className="h-16 border-b border-neutral-800/50 flex items-center justify-between px-8 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <h2 className="text-xl font-bold uppercase tracking-wider text-neutral-200">
            {headerTitles[activeModule]}
          </h2>
          <div className="flex items-center gap-2 bg-neutral-900 px-4 py-1.5 rounded-full border border-neutral-800">
            {eventType === 'drag' ? (
              <Timer size={16} className="text-red-500" />
            ) : (
              <Map size={16} className="text-red-500" />
            )}
            <span className="text-xs font-bold uppercase text-neutral-300">
              MODO: {eventType === 'drag' ? 'DRAG RACING' : 'CIRCUITO'}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 z-10">{renderModule()}</div>
      </main>
    </div>
  )
}
