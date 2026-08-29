// ─── Cliente del módulo de gráficos ───────────────────────────
// El frontend nunca arma comandos AMCP: manda el id del gráfico y el
// backend decide canal, capa y plantilla. Todas las funciones esperan
// la respuesta de FastAPI, que a su vez esperó la de CasparCG.

import { avisarSesionExpirada, cabeceraAuth } from './auth'

const BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

// Un fallo de red y un rechazo de CasparCG se distinguen por `status`:
// 0 = no se llegó al backend, 503 = el backend no alcanzó CasparCG,
// 502 = CasparCG rechazó el comando.
export class GraphicsError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'GraphicsError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  // Las rutas que empiezan por / van al api tal cual; el resto cuelgan
  // de /graphics, que es de donde salió este cliente.
  const url = path.startsWith('/timing') ? `${BASE}${path}` : `${BASE}/graphics${path}`
  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...cabeceraAuth(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new GraphicsError('No se pudo contactar al backend', 0)
  }

  // El token venció o desactivaron al usuario: se cierra la sesión antes
  // de lanzar, para que el panel no siga pidiendo con un token muerto.
  if (response.status === 401) {
    avisarSesionExpirada()
    throw new GraphicsError('La sesión expiró, vuelve a iniciar sesión', 401)
  }

  // Una respuesta de error puede traer JSON o no; nunca debe romper aquí.
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = payload?.detail
    throw new GraphicsError(
      typeof detail === 'string' ? detail : `Error ${response.status}`,
      response.status,
    )
  }

  return payload
}

// ─── Comandos ─────────────────────────────────────────────────

// Saca un gráfico al aire (CG ADD).
// Para las fichas de piloto basta con `pilotId`: el backend arma el
// payload desde la base. `data` es para campos sueltos (narrador, evento).
export const playGraphic = (graphicId, { pilotId, data } = {}) =>
  request('/play', {
    method: 'POST',
    body: { graphic_id: graphicId, pilot_id: pilotId ?? null, data: data ?? null },
  })

// Refresca los datos de un gráfico ya al aire (CG UPDATE).
export const updateGraphic = (graphicId, { pilotId, data } = {}) =>
  request('/update', {
    method: 'POST',
    body: { graphic_id: graphicId, pilot_id: pilotId ?? null, data: data ?? null },
  })

// Limpia la capa de un grupo completo, p. ej. 'background' → CLEAR 1-10.
export const clearGroup = (group) =>
  request('/clear', { method: 'POST', body: { group } })

// Limpia la capa donde vive ese gráfico.
export const clearGraphic = (graphicId) =>
  request('/clear', { method: 'POST', body: { graphic_id: graphicId } })

// Vacía el canal entero (CLEAR 1).
export const clearAll = () => request('/clear-all', { method: 'POST' })

// ─── Consultas ────────────────────────────────────────────────

export const getState = () => request('/state')

export const getTemplates = (group) =>
  request(group ? `/templates?group=${encodeURIComponent(group)}` : '/templates')

// ─── Registro ─────────────────────────────────────────────────
// Pilotos y categorías viven aquí para que el módulo de gráficos
// tenga un solo cliente que mantener.

async function pedirRegistro(ruta) {
  let response
  try {
    response = await fetch(`${BASE}${ruta}`, { headers: cabeceraAuth() })
  } catch {
    throw new GraphicsError('No se pudo contactar al backend', 0)
  }
  if (response.status === 401) {
    avisarSesionExpirada()
    throw new GraphicsError('La sesión expiró, vuelve a iniciar sesión', 401)
  }
  if (!response.ok) throw new GraphicsError(`Error ${response.status}`, response.status)
  return response.json()
}

// Los listados del backend vienen paginados en un sobre {items, total}.
// Aquí se pide la lista completa (sin `limit`) y se devuelve solo `items`:
// el selector de pilotos del panel los necesita todos de una.
export const getPilots = () =>
  pedirRegistro('/pilots/').then(p => p.items)

export const getCategories = () =>
  pedirRegistro('/categories/').then(p => p.items)


// ─── Cronometraje ─────────────────────────────────────────────
// Los carros de la tanda actual, leídos del current.xml por el backend.

export const getLineup = () => pedirRegistro('/timing/lineup')

// Fija cuál de los dos pilotos de un carro compartido sale en el tótem.
export const setDriver = (vehicleId, pilotId) =>
  request('/timing/driver', {
    method: 'POST',
    body: { vehicle_id: vehicleId, pilot_id: pilotId },
  })


// ─── Cuenta atrás ─────────────────────────────────────────────
// El reloj lo lleva el backend para que los cuatro tótems muestren el
// mismo número. Aquí solo se manda arrancar, pausar o reiniciar.

export const getTimer = () => pedirRegistro('/timing/timer')

export const startTimer = () =>
  request('/timing/timer/start', { method: 'POST', body: {} })

export const pauseTimer = () =>
  request('/timing/timer/pause', { method: 'POST', body: {} })

export const resetTimer = () =>
  request('/timing/timer/reset', { method: 'POST', body: {} })

// Modo de la tanda: 'tiempo' con cuenta atrás, o 'vueltas' contando.
export const configTimer = (body) =>
  request('/timing/timer/config', { method: 'POST', body })

// Suma o resta vueltas (delta), o las fija de golpe (absoluta).
export const lapTimer = (body) =>
  request('/timing/timer/lap', { method: 'POST', body })
