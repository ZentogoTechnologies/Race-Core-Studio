// ─── Autenticación ────────────────────────────────────────────
// El token vive en localStorage: sobrevive al F5, que en una consola de
// transmisión pasa seguido. sessionStorage lo perdería al abrir el panel
// en otra pestaña, y aquí es normal tener varias abiertas a la vez.

const BASE =
  // Ruta relativa: el frontend pide a quien se lo sirvió. Así vale
  // igual en localhost, en la red local o a través del túnel, sin
  // tener que recompilar con la dirección de turno.
  import.meta.env.VITE_API_URL || '/api/v1'

const CLAVE = 'rcs.token'

// Cuando el backend responde 401 con un token que creíamos bueno (expiró,
// o desactivaron al usuario), hay que sacar a la sesión de en medio. El
// aviso viaja por evento para que el cliente de API no tenga que importar
// el contexto de React y armar un ciclo entre los dos.
export const EVENTO_EXPIRADA = 'rcs:sesion-expirada'

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    // Modo privado con almacenamiento bloqueado: se sigue sin token.
    return null
  }
}

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE, token)
  } catch { /* sin persistencia, la sesión dura lo que la pestaña */ }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE)
  } catch { /* nada que limpiar */ }
}

export function avisarSesionExpirada() {
  borrarToken()
  window.dispatchEvent(new CustomEvent(EVENTO_EXPIRADA))
}

// Cabecera lista para pegar en cualquier fetch. Vacía si no hay token,
// así el backend responde 401 y no un error raro de cabecera malformada.
export function cabeceraAuth() {
  const token = leerToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class AuthError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function login(username, password) {
  let response
  try {
    response = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new AuthError('No se pudo contactar al backend', 0)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = payload?.detail
    throw new AuthError(
      typeof detail === 'string' ? detail : 'No se pudo iniciar sesión',
      response.status,
    )
  }

  guardarToken(payload.access_token)
  return payload.user
}

// Valida contra el backend el token que quedó guardado. Se llama al
// arrancar la app: un token vencido en localStorage se ve igual de bueno
// que uno vivo hasta que el servidor opina.
export async function obtenerSesion() {
  const token = leerToken()
  if (!token) return null

  let response
  try {
    response = await fetch(`${BASE}/auth/me`, { headers: cabeceraAuth() })
  } catch {
    // Backend caído. No se borra el token: puede seguir siendo válido y
    // sacar al operador al login por un corte de red sería peor.
    throw new AuthError('No se pudo contactar al backend', 0)
  }

  if (response.status === 401) {
    borrarToken()
    return null
  }

  if (!response.ok) throw new AuthError(`Error ${response.status}`, response.status)

  return response.json()
}
