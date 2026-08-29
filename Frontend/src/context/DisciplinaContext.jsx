import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const DisciplinaContext = createContext(null)

export function useDisciplina() {
  const ctx = useContext(DisciplinaContext)
  if (!ctx) throw new Error('useDisciplina debe usarse dentro de <DisciplinaProvider>')
  return ctx
}

export const DISCIPLINAS = [
  { valor: 'circuito', etiqueta: 'Circuito' },
  { valor: 'drag',     etiqueta: 'Drag' },
]

const CLAVE = 'rcs.disciplina'
const VALIDAS = DISCIPLINAS.map(d => d.valor)

function leerGuardada() {
  try {
    const valor = localStorage.getItem(CLAVE)
    // Se valida contra la lista: un valor viejo o editado a mano no puede
    // terminar filtrando la base por una disciplina que no existe.
    return VALIDAS.includes(valor) ? valor : null
  } catch {
    return null
  }
}

export function DisciplinaProvider({ children }) {
  const [disciplina, setDisciplinaEstado] = useState(leerGuardada)

  const elegir = useCallback((valor) => {
    if (!VALIDAS.includes(valor)) return
    setDisciplinaEstado(valor)
  }, [])

  // Vuelve a preguntar la próxima vez que se entre.
  const limpiar = useCallback(() => setDisciplinaEstado(null), [])

  useEffect(() => {
    try {
      if (disciplina) localStorage.setItem(CLAVE, disciplina)
      else localStorage.removeItem(CLAVE)
    } catch { /* almacenamiento bloqueado: dura lo que la pestaña */ }
  }, [disciplina])

  const etiqueta = DISCIPLINAS.find(d => d.valor === disciplina)?.etiqueta || null

  return (
    <DisciplinaContext.Provider value={{ disciplina, etiqueta, elegir, limpiar }}>
      {children}
    </DisciplinaContext.Provider>
  )
}
