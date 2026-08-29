import { BrowserRouter, Navigate, Route, Routes, useOutletContext } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { DisciplinaProvider } from './context/DisciplinaContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RoleRoute from './components/auth/RoleRoute'
import DisciplinaGate from './components/shared/DisciplinaGate'
import LoginScreen from './components/auth/LoginScreen'
import MainLayout from './layouts/MainLayout'
import HomeModule from './pages/Home'
import EventosModule from './pages/Eventos'
import CategoriasModule from './pages/Categorias'
import PilotosModule from './pages/Pilotos'
import VehiculosModule from './pages/Vehiculos'
import GraficosModule from './pages/Graficos'
import UsuariosModule from './pages/Usuarios'

// ─── Módulos que dependen del estado del layout ───────────────
// Los demás piden sus datos al backend. Solo eventos sigue en memoria,
// así que es el único que aún recibe estado por el context del Outlet.

function Inicio() {
  const { eventos } = useOutletContext()
  return <HomeModule eventos={eventos} />
}

function Eventos() {
  const { eventos, setEventos } = useOutletContext()
  return <EventosModule eventos={eventos} setEventos={setEventos} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Los avisos van por fuera de la guarda: un error de sesión
            expirada tiene que poder mostrarse también en el login. */}
        <ToastProvider>
          <DisciplinaProvider>
            <Routes>
              <Route path="/login" element={<LoginScreen />} />

              {/* Primero sesión, después disciplina. En ese orden: la
                  pantalla de disciplina saluda por nombre, y filtrar la
                  base no tiene sentido antes de saber quién entra. */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DisciplinaGate />}>
                  <Route element={<MainLayout />}>
                    <Route index             element={<Inicio />} />
                    <Route path="eventos"    element={<Eventos />} />
                    <Route path="categorias" element={<CategoriasModule />} />
                    <Route path="pilotos"    element={<PilotosModule />} />
                    <Route path="vehiculos"  element={<VehiculosModule />} />
                    <Route path="graficos"   element={<GraficosModule />} />

                    {/* Solo el dueño. Un admin que escriba /usuarios a mano
                        rebota al inicio, y el backend le daría 403 igual. */}
                    <Route element={<RoleRoute roles={['owner']} />}>
                      <Route path="usuarios" element={<UsuariosModule />} />
                    </Route>
                  </Route>
                </Route>
              </Route>

              {/* Una URL escrita a mano que no existe cae en la raíz, y la
                  raíz vuelve a pasar por las guardas. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DisciplinaProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
