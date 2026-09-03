import { createContext, useContext, useEffect, useState } from 'react'
import { elegirIdioma as guardarEnServidor, listarIdiomas } from '../api/registro'
import { fijarIdioma, idiomaDeAhora } from '../i18n'
import { useAuth } from './AuthContext'

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

  const { usuario } = useAuth()

  const [idioma, setIdioma] = useState(idiomaDeAhora())
  const [idiomas, setIdiomas] = useState([])

  /* Se piden al entrar y no al montar. Este proveedor envuelve tambien la
     pantalla de acceso, y la lista de idiomas exige un token: pidiendola
     antes del login devolvia 401, el catch la dejaba vacia y ya no se
     volvia a intentar. El selector de Ajustes salia sin opciones. */
  useEffect(() => {
    if (!usuario) return

    listarIdiomas()
      .then(r => {
        setIdiomas(r.idiomas || [])
        if (r.actual) { fijarIdioma(r.actual); setIdioma(r.actual) }
      })
      .catch(() => {})   // sin backend, se queda en español
  }, [usuario])

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
