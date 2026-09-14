import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ImagePlus, Loader2, Search, X } from 'lucide-react'
import { t } from '../../i18n'
import { listarMarcas, subirLogoMarca, urlLogoMarca } from '../../api/registro'
import { urlBandera } from '../../data/paises'

/* ==========================================================================
   SELECTOR DE MARCA

   Antes la marca se escribía y en la base convivían "Bmw" y "BMW" como si
   fueran dos marcas distintas. Peor: el logo se busca por el nombre, así
   que "Mc Laren" no encontraba su archivo y el gráfico salía sin logo sin
   que nadie se enterara. Ahora se elige de una lista cerrada de 401.

   La lista viene del backend y no se copia aquí: la que manda tiene que
   ser la misma que valida al guardar. Se pide una sola vez para todo el
   panel —son cuatrocientas y no cambian— y se comparte entre montajes.

   Los logos son marcas registradas y no vienen con el sistema. La marca
   que no tenga el suyo sale con la bandera de su país de origen, que es
   mejor pista que un hueco, y se puede subir el logo ahí mismo.
========================================================================== */

const sinTildes = s => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const NOMBRE_TIPO = { auto: 'Autos', moto: 'Motos', kart: 'Karts' }

/* Se pide una vez y se comparte. Sin esto cada apertura del formulario
   traería las cuatrocientas otra vez. */
let promesa = null
const pedirCatalogo = () => {
  if (!promesa) {
    promesa = listarMarcas().then(r => r.marcas || []).catch(e => {
      promesa = null            // que el siguiente intento vuelva a probar
      throw e
    })
  }
  return promesa
}

export default function SelectorMarca({ valor, onChange, puedeSubirLogo = true }) {
  const [marcas,   setMarcas]   = useState([])
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  const [abierto, setAbierto] = useState(false)
  const [busca,   setBusca]   = useState('')
  const [tipo,    setTipo]    = useState('')     // '' = todos
  const [subiendo, setSubiendo] = useState(false)

  const caja   = useRef(null)
  const campo  = useRef(null)
  const fichero = useRef(null)

  // `intento` sube al pulsar "reintentar" y vuelve a disparar la carga.
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    pedirCatalogo()
      .then(lista => { if (vigente) setMarcas(lista) })
      .catch(e => { if (vigente) setError(e.message) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [intento])

  /* Si el catálogo no llegó no se sabe nada de ninguna marca, ni que esté
     ni que falte. Distinguirlo importa: sin esto, un backend caído pintaba
     de ámbar como "fuera del catálogo" a un Renault perfectamente válido y
     parecía que el dato estaba mal cuando el roto era la conexión. */
  const catalogoListo = !cargando && !error && marcas.length > 0

  // Cerrar al pulsar fuera. Sin esto la lista se queda abierta encima de
  // los campos de abajo y tapa el botón de guardar.
  useEffect(() => {
    if (!abierto) return
    const fuera = e => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  useEffect(() => { if (abierto) campo.current?.focus() }, [abierto])

  const indice = useMemo(
    () => marcas.map(m => ({ ...m, busca: `${sinTildes(m.nombre)} ${m.id}` })),
    [marcas],
  )

  const elegida = useMemo(
    () => indice.find(m => sinTildes(m.nombre) === sinTildes(valor)) || null,
    [indice, valor],
  )

  const resultados = useMemo(() => {
    let lista = tipo ? indice.filter(m => m.tipos.includes(tipo)) : indice

    const q = sinTildes(busca)
    if (!q) return lista

    // Las que empiezan por lo escrito van primero: quien teclea "ma"
    // busca Mazda o Maserati, no Yamaha.
    const empiezan = [], contienen = []
    for (const m of lista) {
      const donde = m.busca.indexOf(q)
      if (donde === -1) continue
      ;(donde === 0 || m.busca[donde - 1] === ' ' ? empiezan : contienen).push(m)
    }
    return [...empiezan, ...contienen]
  }, [indice, busca, tipo])

  const elegir = nombre => {
    onChange(nombre)
    setAbierto(false)
    setBusca('')
  }

  /* El logo se sube desde aquí y no obliga a ir a otra pantalla: la marca
     sin logo se descubre justo en este momento, registrando el carro. */
  const subirLogo = async (archivo) => {
    if (!archivo || !elegida) return
    setSubiendo(true)
    try {
      const { logo_url } = await subirLogoMarca(elegida.id, archivo)
      setMarcas(prev => prev.map(m =>
        m.id === elegida.id ? { ...m, logo_url } : m))
      // La copia compartida también, o al reabrir el formulario volvería
      // a salir sin logo.
      promesa = Promise.resolve(marcas.map(m =>
        m.id === elegida.id ? { ...m, logo_url } : m))
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(false)
      if (fichero.current) fichero.current.value = ''
    }
  }

  /* El logo va sobre una baldosa blanca y no directamente sobre el panel.
     Los logos de marca vienen de dos formas: recortados con fondo
     transparente —y la mitad son negros, como Acura o Cupra, que sobre
     este fondo oscuro no se ven— o con su fondo blanco ya pegado, como
     Toyota o Nissan. La baldosa blanca resuelve las dos: los negros
     contrastan y los que ya traen fondo blanco se funden con ella.

     La marca sin logo sale con la bandera de su país de origen. Un hueco
     no dice nada; la bandera al menos sitúa la marca. */
  const Marca = ({ m, tamano = 'w-7 h-5' }) => (
    m.logo_url
      ? <span className={`${tamano} bg-white rounded-[2px] p-[1px] flex-shrink-0 flex items-center justify-center`}>
          <img src={urlLogoMarca(m.logo_url)} alt="" loading="lazy"
               className="max-w-full max-h-full object-contain" />
        </span>
      : <img src={urlBandera(m.pais)} alt="" loading="lazy"
             className={`${tamano} object-cover rounded-[2px] border border-white/20 opacity-50 flex-shrink-0`} />
  )

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        disabled={cargando}
        className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 flex items-center gap-2 text-left hover:border-neutral-700 focus:border-red-600 focus:outline-none transition-colors disabled:opacity-50"
      >
        {cargando
          ? <><Loader2 size={14} className="animate-spin text-neutral-600" />
              <span className="text-neutral-600">{t('Cargando marcas...')}</span></>
          : elegida
            ? <><Marca m={elegida} />
                <span className="text-white truncate">{elegida.nombre}</span></>
            : valor
              /* El ámbar es una acusación —"esta marca no está en la
                 lista"— y solo se puede hacer con el catálogo delante. Si
                 no llegó, la marca se enseña tal cual y en blanco: está
                 guardada y sale al aire igual, lo que falta es el catálogo
                 para contrastarla, y eso lo dice el aviso de abajo.

                 Cuando sí llegó, el ámbar señala lo que hay que sustituir
                 por una marca de la lista. Pintarlo como "Sin marca" haría
                 creer que el dato se perdió, y no se perdió. */
              ? catalogoListo
                ? <><AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-amber-400 truncate" title={t('Fuera del catálogo')}>
                      {valor}
                    </span></>
                : <span className="text-white truncate">{valor}</span>
              : <span className="text-neutral-600 truncate">{t('Sin marca')}</span>}

        {elegida && (
          <span
            role="button" tabIndex={-1}
            onClick={e => { e.stopPropagation(); elegir('') }}
            className="ml-auto text-neutral-600 hover:text-red-400 transition-colors"
            title={t('Quitar')}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={15} className={`text-neutral-600 flex-shrink-0 ${elegida ? '' : 'ml-auto'}`} />
      </button>

      {/* Subir el logo de la marca elegida cuando no lo tiene. Los logos
          son marcas registradas y no vienen con el sistema. */}
      {puedeSubirLogo && elegida && !elegida.logo_url && (
        <>
          <button
            type="button" onClick={() => fichero.current?.click()} disabled={subiendo}
            className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {subiendo
              ? <Loader2 size={12} className="animate-spin" />
              : <ImagePlus size={12} />}
            {t('Subir logo de')} {elegida.nombre}
          </button>
          <input
            ref={fichero} type="file" accept="image/*" className="hidden"
            onChange={e => subirLogo(e.target.files?.[0])}
          />
        </>
      )}

      {/* "Error 500" a secas no le dice nada a quien está inscribiendo un
          carro. Se nombra lo que falló —el catálogo, no la marca— y se
          ofrece reintentar, que es lo que arregla el caso normal: el
          backend se reinició y el panel se quedó sin la lista. */}
      {error && (
        <p className="mt-1 text-[11px] text-red-400">
          {t('No se pudo cargar el catálogo de marcas')} ({error}).{' '}
          <button
            type="button" onClick={() => setIntento(n => n + 1)}
            className="underline hover:text-red-300"
          >
            {t('Reintentar')}
          </button>
        </p>
      )}

      {abierto && (
        <div className="absolute z-30 mt-1 w-full bg-[#0f0f0f] border border-neutral-700 rounded-lg shadow-2xl overflow-hidden">

          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
            <Search size={14} className="text-neutral-600 flex-shrink-0" />
            <input
              ref={campo} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={t('Buscar marca...')}
              className="w-full bg-transparent text-white text-sm focus:outline-none"
              onKeyDown={e => {
                if (e.key === 'Escape') setAbierto(false)
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (resultados.length) elegir(resultados[0].nombre)
                }
              }}
            />
          </div>

          {/* Acotar por lo que se registra. Cuatrocientas marcas mezclando
              autos, motos y karts es una lista difícil de recorrer. */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-neutral-800">
            {[['', 'Todas'], ...Object.entries(NOMBRE_TIPO)].map(([v, etiqueta]) => (
              <button
                key={v || 'todas'} type="button" onClick={() => setTipo(v)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-colors ${
                  tipo === v ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-white'}`}
              >
                {t(etiqueta)}
              </button>
            ))}
            <span className="ml-auto pr-1 text-[10px] text-neutral-600 tabular-nums">
              {resultados.length}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {/* Con el catálogo caído la lista también sale vacía, y decir
                ahí "ninguna coincide" manda a buscar el fallo en lo que se
                escribió cuando el fallo es que no hay lista. */}
            {resultados.length === 0 && (
              <p className="px-3 py-4 text-neutral-600 text-sm text-center">
                {catalogoListo
                  ? t('Ninguna marca coincide')
                  : t('El catálogo de marcas no está disponible')}
              </p>
            )}
            {resultados.map(m => (
              <button
                key={m.id} type="button" onClick={() => elegir(m.nombre)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  elegida?.id === m.id
                    ? 'bg-red-600/15 text-white'
                    : 'text-neutral-300 hover:bg-neutral-800'}`}
              >
                <Marca m={m} tamano="w-7 h-5" />
                <span className="truncate">{m.nombre}</span>
                {!m.logo_url && (
                  <span className="ml-auto text-[10px] uppercase text-neutral-700 flex-shrink-0">
                    {t('sin logo')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
