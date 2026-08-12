import { useState } from 'react'
import { Menu, X, Home, Users, Car, LogOut, Calendar, Tag, BarChart3 } from 'lucide-react'
import NavItem        from '../components/layout/NavItem'
import HomeModule     from '../pages/Home'
import EventosModule  from '../pages/Eventos'
import CategoriasModule from '../pages/Categorias'
import PilotosModule  from '../pages/Pilotos'
import VehiculosModule from '../pages/Vehiculos'
import GraficosModule from '../pages/Graficos'

export default function MainLayout({ onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeModule,  setActiveModule]  = useState('home')

  // ── Estado global vacío al iniciar ──
  const [pilotos,    setPilotos]    = useState([])
  const [vehiculos,  setVehiculos]  = useState([])
  const [categorias, setCategorias] = useState([])
  const [eventos,    setEventos]    = useState([])

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return (
          <HomeModule
            stats={{ p: pilotos.length, v: vehiculos.length, c: categorias.length, e: eventos.length }}
            allData={{ eventos, categorias, pilotos, vehiculos }}
          />
        )
      case 'eventos':
        return <EventosModule eventos={eventos} setEventos={setEventos} />
      case 'categorias':
        return <CategoriasModule categorias={categorias} setCategorias={setCategorias} />
      case 'pilotos':
        return <PilotosModule pilotos={pilotos} setPilotos={setPilotos} />
      case 'vehiculos':
        return (
          <VehiculosModule
            vehiculos={vehiculos}   setVehiculos={setVehiculos}
            categorias={categorias}
            pilotos={pilotos}
          />
        )
      case 'graficos':
        return <GraficosModule />
      default:
        return <HomeModule stats={{ p: 0, v: 0, c: 0, e: 0 }} allData={{ eventos, categorias, pilotos, vehiculos }} />
    }
  }

  const headerTitles = {
    home: 'Panel Principal', eventos: 'Gestión de Eventos',
    categorias: 'Gestión de Categorías', pilotos: 'Directorio de Pilotos',
    vehiculos: 'Directorio de Vehículos', graficos: 'Gráficos',
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      <aside className={`bg-[#141414] border-r border-neutral-800 transition-all duration-300 flex flex-col z-20 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800">
          {isSidebarOpen && (
            <span className="text-lg font-black italic tracking-wide text-white whitespace-nowrap">
              RACE CORE <span className="text-red-600">STUDIO</span>
            </span>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white mx-auto">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          <NavItem icon={<Home />}     label="Inicio"     isActive={activeModule === 'home'}       onClick={() => setActiveModule('home')}       isOpen={isSidebarOpen} />
          <div className="my-2 border-t border-neutral-800" />
          <NavItem icon={<Calendar />} label="Eventos"    isActive={activeModule === 'eventos'}    onClick={() => setActiveModule('eventos')}    isOpen={isSidebarOpen} />
          <NavItem icon={<Tag />}      label="Categorías" isActive={activeModule === 'categorias'} onClick={() => setActiveModule('categorias')} isOpen={isSidebarOpen} />
          <NavItem icon={<Users />}    label="Pilotos"    isActive={activeModule === 'pilotos'}    onClick={() => setActiveModule('pilotos')}    isOpen={isSidebarOpen} />
          <NavItem icon={<Car />}      label="Vehículos"  isActive={activeModule === 'vehiculos'}  onClick={() => setActiveModule('vehiculos')}  isOpen={isSidebarOpen} />
          <NavItem icon={<BarChart3 />} label="Gráficos"  isActive={activeModule === 'graficos'}   onClick={() => setActiveModule('graficos')}   isOpen={isSidebarOpen} />
        </nav>
        <div className="p-4 border-t border-neutral-800">
          <button onClick={onLogout} className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} py-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors gap-3`}>
            <LogOut size={18} />
            {isSidebarOpen && <span className="font-semibold text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-2 bg-red-600 rounded-bl-3xl opacity-80 z-0" />
        <header className="h-16 border-b border-neutral-800/50 flex items-center px-8 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <h2 className="text-xl font-bold uppercase tracking-wider text-neutral-200">{headerTitles[activeModule]}</h2>
        </header>
        <div className="flex-1 overflow-auto p-8 z-10">{renderModule()}</div>
      </main>
    </div>
  )
}
