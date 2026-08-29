import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  EVENTO_EXPIRADA, borrarToken, leerToken, login as pedirLogin, obtenerSesion,
} from '../api/auth'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const [usuario,   setUsuario]   = useState(null)
  // `cargando` arranca en true a propósito: mientras no sepamos si el
  // token guardado sirve, no se puede decidir si mostrar el login o el
  // panel. Sin esto se ve un parpadeo del login en cada recarga.
  const [cargando,  setCargando]  = useState(true)
  const [sinBackend, setSinBackend] = useState(false)

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  const iniciarSesion = useCallback(async (username, password) => {
    const u = await pedirLogin(username, password)
    setUsuario(u)
    setSinBackend(false)
    return u
  }, [])

  // Validación del token guardado al arrancar la app.
  useEffect(() => {
    let vigente = true

    ;(async () => {
      if (!leerToken()) {
        if (vigente) setCargando(false)
        return
      }
      try {
        const u = await obtenerSesion()
        if (vigente) setUsuario(u)
      } catch {
        // Backend inalcanzable. Se deja al usuario fuera, pero se avisa
        // que el problema es de conexión y no de credenciales.
        if (vigente) setSinBackend(true)
      } finally {
        if (vigente) setCargando(false)
      }
    })()

    return () => { vigente = false }
  }, [])

  // Cualquier 401 disparado desde el cliente de API cierra la sesión.
  useEffect(() => {
    const alExpirar = () => setUsuario(null)
    window.addEventListener(EVENTO_EXPIRADA, alExpirar)
    return () => window.removeEventListener(EVENTO_EXPIRADA, alExpirar)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        usuario,
        cargando,
        sinBackend,
        autenticado: Boolean(usuario),
        rol: usuario?.role || null,

        // Tres niveles: owner administra cuentas, owner y admin escriben
        // en la base, y standard entra a mirar y a operar los gráficos.
        // Esto solo decide qué se dibuja; quien manda es el backend, que
        // responde 403 aunque alguien llame la ruta a mano.
        esOwner: usuario?.role === 'owner',
        puedeEscribir: usuario?.role === 'owner' || usuario?.role === 'admin',
        iniciarSesion,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
