import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

/**
 * Guarda de rutas. Envuelve todo lo que exija sesión.
 *
 * No basta con esconder los módulos: el backend rechaza cualquier consulta
 * sin token, así que esto es comodidad para el operador, no la seguridad.
 * La seguridad está del otro lado.
 */
export default function ProtectedRoute() {
  const { autenticado, cargando } = useAuth()
  const location = useLocation()

  // Mientras se valida el token guardado no se decide nada: redirigir
  // aquí mandaría al login a alguien que sí tiene sesión válida.
  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    )
  }

  if (!autenticado) {
    // `state.desde` deja volver a donde iba después de entrar.
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }

  return <Outlet />
}
