import { createContext, useContext, useEffect, useState } from 'react'
import { elegirIdioma as guardarEnServidor, listarIdiomas } from '../api/registro'
import { fijarIdioma, idiomaDeAhora } from '../i18n'

/* ==========================================================================
   IDIOMA

   El idioma es del sistema y no del navegador: lo elige quien opera y vale
   para la interfaz y para los gráficos a la vez. Por eso vive en la base y
   no en localStorage, y por eso al cambiarlo el backend reescribe también
   el archivo de textos que leen las plantillas de CasparCG.

   `t` no es un hook, así que cambiar de idioma no rerenderiza por su
   cuenta. Se resuelve remontando el árbol con una key: es un cambio que
   ocurre una vez cada mucho, no en mitad de una carrera, y evita tener que
   enganchar un hook dentro de cada componente del panel.
========================================================================== */

const IdiomaContext = createContext({ idioma: 'es', idiomas: [], cambiar: async () => {} })

export function IdiomaProvider({ children }) {

  const [idioma, setIdioma] = useState(idiomaDeAhora())
  const [idiomas, setIdiomas] = useState([])

  useEffect(() => {
    listarIdiomas()
      .then(r => {
        setIdiomas(r.idiomas || [])
        if (r.actual) { fijarIdioma(r.actual); setIdioma(r.actual) }
      })
      .catch(() => {})   // sin backend, se queda en español
  }, [])

  const cambiar = async (id) => {
    await guardarEnServidor(id)
    fijarIdioma(id)
    setIdioma(id)
  }

  return (
    <IdiomaContext.Provider value={{ idioma, idiomas, cambiar }}>
      {/* La key fuerza el remontado: es lo que hace que las cadenas ya
          pintadas se vuelvan a leer del diccionario nuevo. */}
      <div key={idioma} className="contents">{children}</div>
    </IdiomaContext.Provider>
  )
}

export const useIdioma = () => useContext(IdiomaContext)
