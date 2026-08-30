import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu, X, Home, Users, Car, LogOut, Calendar, Tag, BarChart3,
  Shield, Flag, Zap, Repeat, SlidersHorizontal,
} from 'lucide-react'
import NavItem from '../components/layout/NavItem'
import { useAuth } from '../context/AuthContext'
import { useDisciplina } from '../context/DisciplinaContext'

// Una sola tabla para el sidebar, el título de la cabecera y las rutas:
// antes eran tres listas separadas que había que acordarse de tocar juntas.
// `roles` limita quién ve la entrada; sin `roles`, la ve cualquiera.
const MODULOS = [
  { to: '/',           icon: <Home />,      label: 'Inicio',     titulo: 'Panel Principal' },
  { to: '/eventos',    icon: <Calendar />,  label: 'Eventos',    titulo: 'Gestión de Eventos',    separar: true },
  { to: '/categorias', icon: <Tag />,       label: 'Categorías', titulo: 'Gestión de Categorías' },
  { to: '/pilotos',    icon: <Users />,     label: 'Pilotos',    titulo: 'Directorio de Pilotos' },
  { to: '/vehiculos',  icon: <Car />,       label: 'Vehículos',  titulo: 'Directorio de Vehículos' },
  { to: '/graficos',   icon: <BarChart3 />, label: 'Gráficos',   titulo: 'Gráficos' },
  { to: '/ajustes',    icon: <SlidersHorizontal />, label: 'Ajustes', titulo: 'Ajustes del Sistema',
    separar: true, roles: ['owner', 'admin'] },
  { to: '/usuarios',   icon: <Shield />,    label: 'Usuarios',   titulo: 'Gestión de Usuarios',
    roles: ['owner'] },
]

const ROTULO_ROL = { owner: 'DUEÑO', admin: 'ADMIN', standard: 'ESTÁNDAR' }
const ICONO_DISCIPLINA = { circuito: Flag, drag: Zap }

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const { usuario, rol, cerrarSesion } = useAuth()
  const { disciplina, etiqueta: etiquetaDisciplina, limpiar: cambiarDisciplina } = useDisciplina()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const visibles = MODULOS.filter(m => !m.roles || m.roles.includes(rol))
  const IconoDisciplina = ICONO_DISCIPLINA[disciplina] || Flag

  // Ya no hay estado compartido: cada módulo pide sus datos al backend
  // con su propia paginación.

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  const titulo = MODULOS.find(m => m.to === pathname)?.titulo || 'Panel Principal'

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

        {/* Disciplina activa. Filtra categorías, pilotos y vehículos, así
            que tiene que verse siempre: si no, no hay forma de saber por
            qué una tabla salió vacía. */}
        <button
          onClick={cambiarDisciplina}
          title="Cambiar de disciplina"
          className={`mx-3 mt-4 flex items-center gap-2 rounded-lg border border-neutral-800 hover:border-red-600/60 bg-[#0a0a0a] transition-colors group ${isSidebarOpen ? 'px-3 py-2.5' : 'p-2.5 justify-center'}`}
        >
          <IconoDisciplina size={16} className="text-red-500 flex-shrink-0" />
          {isSidebarOpen && (
            <>
              <span className="flex-1 text-left">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-500">Disciplina</span>
                <span className="block text-sm font-bold text-neutral-200">{etiquetaDisciplina}</span>
              </span>
              <Repeat size={14} className="text-neutral-600 group-hover:text-red-500 transition-colors" />
            </>
          )}
        </button>

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          {visibles.map(m => (
            <div key={m.to}>
              {m.separar && <div className="my-2 border-t border-neutral-800" />}
              {/* NavLink resuelve solo cuál está activo y, al ser un <a>,
                  deja abrir un módulo en otra pestaña con clic derecho. */}
              <NavLink to={m.to} end={m.to === '/'}>
                {({ isActive }) => (
                  <NavItem icon={m.icon} label={m.label} isActive={isActive} isOpen={isSidebarOpen} />
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-800">
          {isSidebarOpen && usuario && (
            <div className="mb-3 px-1">
              <p className="text-sm font-semibold text-neutral-200 truncate">{usuario.username}</p>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">{ROTULO_ROL[usuario.role] || usuario.role}</p>
            </div>
          )}
          <button onClick={salir} className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} py-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors gap-3`}>
            <LogOut size={18} />
            {isSidebarOpen && <span className="font-semibold text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-2 bg-red-600 rounded-bl-3xl opacity-80 z-0" />
        <header className="h-16 border-b border-neutral-800/50 flex items-center px-8 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <h2 className="text-xl font-bold uppercase tracking-wider text-neutral-200">{titulo}</h2>
        </header>
        <div className="flex-1 overflow-auto p-8 z-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
