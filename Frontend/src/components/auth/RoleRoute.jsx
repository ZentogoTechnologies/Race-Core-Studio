import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Guarda por rol. Envuelve las rutas que no son para todos.
 *
 * Es comodidad, no seguridad: quien tenga un token puede llamar la ruta
 * del backend a mano igual. Lo que de verdad cierra el paso son las
 * dependencias `solo_owner` y `puede_escribir` del servidor.
 */
export default function RoleRoute({ roles }) {
  const { rol, cargando } = useAuth()

  // ProtectedRoute ya resolvió la sesión antes de llegar aquí; esto es por
  // si alguien monta RoleRoute suelto en el futuro.
  if (cargando) return null

  if (!roles.includes(rol)) return <Navigate to="/" replace />

  return <Outlet />
}
