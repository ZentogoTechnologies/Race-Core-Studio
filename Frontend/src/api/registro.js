// ─── CRUD de pilotos, vehículos y categorías ──────────────────
// Los listados vienen paginados desde el backend: {items, total, skip,
// limit}. La paginación, la búsqueda y el ordenamiento ocurren en Mongo,
// así que la página que se ve siempre corresponde al total que se muestra.

import { avisarSesionExpirada, cabeceraAuth } from './auth'

const BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// FastAPI devuelve `detail` como string en los HTTPException que lanzamos,
// pero como lista de objetos cuando falla la validación del cuerpo. Los dos
// casos tienen que llegar al toast como una frase legible.
function leerDetalle(payload, status) {
  const detail = payload?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return detail
      .map(e => {
        const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null
        return campo ? `${campo}: ${e.msg}` : e.msg
      })
      .join(' · ')
  }

  return `Error ${status}`
}

async function pedir(ruta, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${BASE}${ruta}`, {
      method,
      headers: {
        ...cabeceraAuth(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('No se pudo contactar al backend', 0)
  }

  if (response.status === 401) {
    avisarSesionExpirada()
    throw new ApiError('La sesión expiró, vuelve a iniciar sesión', 401)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) throw new ApiError(leerDetalle(payload, response.status), response.status)

  return payload
}

// Arma el query string saltando lo vacío: sin esto se manda `search=` y el
// backend recibe una cadena vacía en vez de ausencia de filtro.
function query(params = {}) {
  const qs = new URLSearchParams()

  Object.entries(params).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return
    qs.append(clave, valor)
  })

  const texto = qs.toString()
  return texto ? `?${texto}` : ''
}

function recurso(ruta) {
  return {
    listar:    (params) => pedir(`${ruta}/${query(params)}`),
    obtener:   (id)     => pedir(`${ruta}/${id}`),
    crear:     (datos)  => pedir(`${ruta}/`, { method: 'POST', body: datos }),
    actualizar:(id, d)  => pedir(`${ruta}/${id}`, { method: 'PUT', body: d }),
    eliminar:  (id)     => pedir(`${ruta}/${id}`, { method: 'DELETE' }),
  }
}

export const pilotosApi    = recurso('/pilots')
export const vehiculosApi  = recurso('/vehicles')
export const categoriasApi = recurso('/categories')

// Solo responde al usuario dueño; a cualquier otro rol el backend le
// devuelve 403 aunque llame la ruta directamente.
export const eventosApi    = recurso('/events')

// Las sesiones no son un recurso aparte: viven dentro del evento y las
// dos operaciones devuelven el evento entero ya recalculado, con el
// nombre y el número que le tocó a la sesión nueva.
export const agregarSesion = (eventId, datos) =>
  pedir(`/events/${eventId}/sesiones`, { method: 'POST', body: datos })

export const quitarSesion = (eventId, numeroOrden) =>
  pedir(`/events/${eventId}/sesiones/${numeroOrden}`, { method: 'DELETE' })

// ─── Ajustes en caliente ──────────────────────────────────────
// La ruta del current.xml se cambia sin reiniciar el backend: queda
// guardada en la base y se aplica en la siguiente lectura.

export const leerAjustes = () => pedir('/settings/')

export const probarRutaXml = (ruta) =>
  pedir('/settings/timing/probar', { method: 'POST', body: { timing_xml_path: ruta } })

export const guardarRutaXml = (ruta) =>
  pedir('/settings/timing', { method: 'PUT', body: { timing_xml_path: ruta } })

export const usuariosApi   = recurso('/users')

// Apaga CasparCG, el frontend y el backend. MongoDB no se toca. Solo
// responde a owner y admin; a un estándar el backend le da 403.
//
// El backend se cierra a sí mismo justo después de contestar, así que
// esta llamada devuelve el resumen y acto seguido el API deja de existir:
// quien la use no debe encadenar nada detrás.
export const apagarSistema = () => pedir('/system/shutdown', { method: 'POST' })
