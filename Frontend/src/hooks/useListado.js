import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Listado paginado contra el backend.
 *
 * Búsqueda, ordenamiento y página viajan al servidor en cada consulta. Es
 * a propósito: ordenar en el navegador solo ordenaría la página visible, y
 * el orden cambiaría al pasar de página.
 */
export function useListado(api, { ordenInicial, filtros = {}, tamanoInicial = 25 } = {}) {
  const [items,    setItems]    = useState([])
  const [total,    setTotal]    = useState(0)
  const [skip,     setSkip]     = useState(0)
  const [limit,    setLimit]    = useState(tamanoInicial)
  const [texto,    setTexto]    = useState('')     // lo que se está escribiendo
  const [busqueda, setBusqueda] = useState('')     // lo que ya se consultó
  const [sortBy,   setSortBy]   = useState(ordenInicial || null)
  const [sortDir,  setSortDir]  = useState('asc')
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  // Contador de consultas: si el operador escribe rápido, la respuesta de
  // una búsqueda vieja puede llegar después de la nueva y pisar la tabla
  // con resultados que ya no corresponden.
  const consultaActual = useRef(0)

  // El buscador espera a que dejen de escribir. Sin esto son ocho
  // consultas para escribir "Barrios".
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto), 350)
    return () => clearTimeout(t)
  }, [texto])

  // Cualquier cambio de filtro devuelve a la primera página: quedarse en
  // la página 7 de un resultado que ahora tiene 2 muestra una tabla vacía.
  useEffect(() => { setSkip(0) }, [busqueda, sortBy, sortDir, limit])

  // Los filtros extra llegan como objeto nuevo en cada render; se compara
  // por contenido para no disparar una consulta en cada repintado.
  const filtrosFirma = JSON.stringify(filtros)

  const cargar = useCallback(async () => {
    const miConsulta = ++consultaActual.current
    setCargando(true)

    try {
      const pagina = await api.listar({
        skip, limit,
        search: busqueda || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
        ...JSON.parse(filtrosFirma),
      })

      if (miConsulta !== consultaActual.current) return  // llegó tarde

      setItems(pagina.items)
      setTotal(pagina.total)
      setError(null)
    } catch (err) {
      if (miConsulta !== consultaActual.current) return
      setError(err)
      setItems([])
      setTotal(0)
    } finally {
      if (miConsulta === consultaActual.current) setCargando(false)
    }
  }, [api, skip, limit, busqueda, sortBy, sortDir, filtrosFirma])

  useEffect(() => { cargar() }, [cargar])

  const ordenarPor = useCallback((campo) => {
    setSortBy(actual => {
      if (actual === campo) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        return actual
      }
      setSortDir('asc')
      return campo
    })
  }, [])

  return {
    items, total, skip, limit, cargando, error,
    texto, setTexto,
    sortBy, sortDir, ordenarPor,
    setSkip, setLimit,
    recargar: cargar,
  }
}
