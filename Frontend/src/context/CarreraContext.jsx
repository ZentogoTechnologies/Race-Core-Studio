import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const CarreraContext = createContext(null)

export function useCarrera() {
  const ctx = useContext(CarreraContext)
  if (!ctx) throw new Error('useCarrera debe usarse dentro de <CarreraProvider>')
  return ctx
}

const CLAVE = 'rcs.carrera'

function leerGuardada() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const v = JSON.parse(crudo)
    // Se valida la forma: un valor a medias de una versión anterior
    // dejaría la cabecera del panel pintando "undefined".
    return v && v.event_id ? v : null
  } catch {
    return null
  }
}

/**
 * Qué carrera se está graficando.
 *
 * Guarda el evento y, si se eligió, la sesión concreta (Practice 2 · TCR).
 * `omitida` es distinto de "sin elegir": significa que alguien decidió
 * entrar sin carrera, y con eso solo se habilita la pestaña General.
 */
export function CarreraProvider({ children }) {
  const [carrera, setCarrera] = useState(leerGuardada)
  const [omitida, setOmitida] = useState(false)

  const elegir = useCallback((evento, sesion = null) => {
    if (!evento) return
    setCarrera({
      event_id: evento.event_id,
      nombre: evento.name,
      start_date: evento.start_date,
      end_date: evento.end_date,
      // Ruta ya resuelta por el backend; el gráfico de Evento la pinta a
      // la derecha del nombre.
      image_url: evento.image_url || null,
      categorias: evento.categorias || [],
      sesion: sesion
        ? {
            numero_orden: sesion.numero_orden,
            nombre: sesion.nombre,
            tipo: sesion.tipo,
            dia: sesion.dia,
            category_ids: sesion.category_ids,
          }
        : null,
    })
    setOmitida(false)
  }, [])

  const omitir = useCallback(() => {
    setCarrera(null)
    setOmitida(true)
  }, [])

  // Volver a preguntar. No se limpia `omitida` aquí sino en el propio
  // selector, para que al pulsar "cambiar" se vea la pantalla otra vez.
  const limpiar = useCallback(() => {
    setCarrera(null)
    setOmitida(false)
  }, [])

  useEffect(() => {
    try {
      if (carrera) localStorage.setItem(CLAVE, JSON.stringify(carrera))
      else localStorage.removeItem(CLAVE)
    } catch { /* almacenamiento bloqueado: dura lo que la pestaña */ }
  }, [carrera])

  return (
    <CarreraContext.Provider
      value={{
        carrera,
        omitida,
        // Con carrera elegida se abre todo; omitiéndola, solo General.
        hayCarrera: Boolean(carrera),
        elegir,
        omitir,
        limpiar,
      }}
    >
      {children}
    </CarreraContext.Provider>
  )
}
