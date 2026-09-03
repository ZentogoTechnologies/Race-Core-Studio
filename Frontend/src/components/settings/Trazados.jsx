import { t } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import {
  Check, ImageIcon, Loader2, Map, Plus, Trash2, Upload, X,
} from 'lucide-react'
import {
  activarTrazado, borrarTrazado, crearTrazado, imagenTrazadoPorRuta,
  listarTrazados, subirImagenTrazado, urlImagenTrazado,
} from '../../api/registro'
import { useToast } from '../../context/ToastContext'

const DISCIPLINAS = [
  { valor: 'circuito', etiqueta: 'Circuito' },
  { valor: 'drag',     etiqueta: 'Drag' },
]

const NUEVO = { name: '', variante: '', discipline: 'circuito', length_km: '' }

/**
 * Trazados de pista.
 *
 * No es "la imagen del circuito" sino una lista, porque el mismo recinto se
 * corre de varias formas: la pista corta, la larga cuando se amplíe, el
 * cuarto de milla para drag. Se marca uno como activo y es el que sale en el
 * gráfico de Circuito.
 *
 * La imagen entra de dos maneras, subida desde aquí o escrita su ruta en el
 * servidor, y en los dos casos acaba copiada dentro de la plantilla de
 * CasparCG: una imagen suelta en otro disco puede no resolverse al aire.
 */
export default function Trazados() {
  const toast = useToast()

  const [items,    setItems]    = useState([])
  const [cargando, setCargando] = useState(true)
  const [nuevo,    setNuevo]    = useState(NUEVO)
  const [creando,  setCreando]  = useState(false)
  const [alta,     setAlta]     = useState(false)   // formulario de alta abierto
  const [abierto,  setAbierto]  = useState(null)    // trazado con la imagen desplegada
  const [rutas,    setRutas]    = useState({})      // ruta escrita por trazado
  const [ocupado,  setOcupado]  = useState(null)    // id en el que se está trabajando

  // Un input por trazado: uno solo compartido obligaría a limpiarlo entre
  // usos para poder elegir dos veces la misma imagen.
  const inputs = useRef({})

  const cargar = () => {
    setCargando(true)
    listarTrazados()
      .then(r => setItems(r.items))
      .catch(err => toast.error('No se pudieron cargar los trazados', err.message))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const crear = async (e) => {
    e.preventDefault()
    if (!nuevo.name.trim()) return

    setCreando(true)
    try {
      const doc = await crearTrazado({
        name: nuevo.name.trim(),
        variante: nuevo.variante.trim() || null,
        discipline: nuevo.discipline,
        // Vacío es "no lo sé", no cero: el campo es opcional en el backend.
        length_km: nuevo.length_km === '' ? null : Number(nuevo.length_km),
      })
      setItems(prev => [...prev, doc])
      setNuevo(NUEVO)
      setAlta(false)
      // Recién creado no tiene imagen, así que se abre directamente donde
      // toca ponerla en vez de dejar una tarjeta a medias.
      setAbierto(doc.trazado_id)
      toast.exito('Trazado creado', 'Ahora ponle la imagen de la pista')
    } catch (err) {
      toast.error('No se pudo crear', err.message)
    } finally {
      setCreando(false)
    }
  }

  const reemplazar = (doc) =>
    setItems(prev => prev.map(t => (t.trazado_id === doc.trazado_id ? doc : t)))

  const activar = async (t) => {
    setOcupado(t.trazado_id)
    try {
      await activarTrazado(t.trazado_id)
      // Se recarga entero: activar uno apaga al que estuviera, y esa
      // segunda tarjeta también tiene que reflejarlo.
      const r = await listarTrazados()
      setItems(r.items)
      toast.exito('Trazado en uso', [t.name, t.variante].filter(Boolean).join(' · '))
    } catch (err) {
      toast.error('No se pudo activar', err.message)
    } finally {
      setOcupado(null)
    }
  }

  const subir = async (t, archivo) => {
    if (!archivo) return
    setOcupado(t.trazado_id)
    try {
      reemplazar(await subirImagenTrazado(t.trazado_id, archivo))
      toast.exito('Imagen cargada', archivo.name)
    } catch (err) {
      toast.error('No se pudo cargar la imagen', err.message)
    } finally {
      setOcupado(null)
      // Sin esto, volver a elegir el mismo archivo no dispara el onChange.
      if (inputs.current[t.trazado_id]) inputs.current[t.trazado_id].value = ''
    }
  }

  const traer = async (t) => {
    const ruta = (rutas[t.trazado_id] || '').trim()
    if (!ruta) return

    setOcupado(t.trazado_id)
    try {
      reemplazar(await imagenTrazadoPorRuta(t.trazado_id, ruta))
      setRutas(prev => ({ ...prev, [t.trazado_id]: '' }))
      toast.exito('Imagen cargada', 'Copiada dentro de la plantilla')
    } catch (err) {
      toast.error('No se pudo tomar esa imagen', err.message)
    } finally {
      setOcupado(null)
    }
  }

  const borrar = async (t) => {
    const nombre = [t.name, t.variante].filter(Boolean).join(' · ')
    if (!window.confirm(`¿Borrar el trazado "${nombre}"? También se borra su imagen.`)) return

    setOcupado(t.trazado_id)
    try {
      await borrarTrazado(t.trazado_id)
      const r = await listarTrazados()   // el activo puede haber cambiado
      setItems(r.items)
      toast.exito('Trazado borrado', nombre)
    } catch (err) {
      toast.error('No se pudo borrar', err.message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">

      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <Map size={17} className="text-neutral-500"/>
          <h3 className="text-lg font-black italic text-white">{t('TRAZADOS DE PISTA')}</h3>
        </div>
        <button
          type="button"
          onClick={() => setAlta(a => !a)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 transition-colors font-bold text-xs flex-shrink-0"
        >
          {alta ? <X size={14}/> : <Plus size={14}/>}
          {alta ? 'CANCELAR' : 'NUEVO'}
        </button>
      </div>

      <p className="text-neutral-500 text-sm mb-5">
        El gráfico de Circuito muestra el trazado marcado en uso. Da de alta uno por
        cada forma de correr el recinto: la pista corta, la larga, el cuarto de milla.
      </p>

      {alta && (
        <form onSubmit={crear} className="border border-neutral-800 rounded-lg p-4 mb-5 bg-[#0a0a0a]">
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-neutral-400 text-xs mb-1.5 uppercase">
                {t('Nombre del circuito')}
              </label>
              <input
                type="text" value={nuevo.name} autoFocus
                onChange={e => setNuevo(n => ({ ...n, name: e.target.value }))}
                placeholder="Autódromo Panamá"
                className="w-full bg-[#141414] border border-neutral-800 rounded p-2.5 text-sm focus:border-red-600 focus:outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1.5 uppercase">
                {t('Variante')}
              </label>
              <input
                type="text" value={nuevo.variante}
                onChange={e => setNuevo(n => ({ ...n, variante: e.target.value }))}
                placeholder="Pista corta · 2.5 km"
                className="w-full bg-[#141414] border border-neutral-800 rounded p-2.5 text-sm focus:border-red-600 focus:outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1.5 uppercase">
                {t('Disciplina')}
              </label>
              <select
                value={nuevo.discipline}
                onChange={e => setNuevo(n => ({ ...n, discipline: e.target.value }))}
                className="w-full bg-[#141414] border border-neutral-800 rounded p-2.5 text-sm focus:border-red-600 focus:outline-none text-white"
              >
                {DISCIPLINAS.map(d => (
                  <option key={d.valor} value={d.valor}>{t(d.etiqueta)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1.5 uppercase">
                {t('Longitud en km')}
              </label>
              <input
                type="number" step="0.001" min="0" value={nuevo.length_km}
                onChange={e => setNuevo(n => ({ ...n, length_km: e.target.value }))}
                placeholder="2.5"
                className="w-full bg-[#141414] border border-neutral-800 rounded p-2.5 text-sm focus:border-red-600 focus:outline-none text-white"
              />
            </div>
          </div>

          <button
            type="submit" disabled={creando || !nuevo.name.trim()}
            className="flex items-center gap-2 bg-white text-black font-bold py-2.5 px-5 rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {creando ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}
            CREAR TRAZADO
          </button>
        </form>
      )}

      {cargando ? (
        <div className="py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-red-600"/>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Todavía no hay ningún trazado. El gráfico de Circuito usará la imagen que
          trae la plantilla de fábrica hasta que des uno de alta.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(t => {
            const trabajando = ocupado === t.trazado_id
            const desplegado = abierto === t.trazado_id
            const imagen = urlImagenTrazado(t.image)

            return (
              <div
                key={t.trazado_id}
                className={`rounded-lg border transition-colors ${
                  t.activo ? 'border-red-600/60 bg-red-600/5' : 'border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3 p-3">

                  {/* Miniatura. Sin imagen se deja el hueco marcado, que es
                      justo lo que falta por hacer en ese trazado. */}
                  <div className="w-20 h-14 rounded bg-[#0a0a0a] border border-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {imagen
                      ? <img src={imagen} alt="" className="w-full h-full object-contain"/>
                      : <ImageIcon size={18} className="text-neutral-700"/>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{t.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {t.variante || 'Sin variante'}
                      {t.length_km ? ` · ${t.length_km} km` : ''}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 uppercase tracking-wider">
                      {t.discipline}
                    </span>
                    {!t.image && (
                      <span className="inline-block mt-1 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-600/15 text-yellow-500 uppercase tracking-wider">
                        {t('Sin imagen')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.activo ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-red-600/15 text-red-400">
                        <Check size={12}/> {t('EN USO')}
                      </span>
                    ) : (
                      <button
                        type="button" onClick={() => activar(t)} disabled={trabajando}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 disabled:opacity-40 transition-colors"
                      >
                        {t('USAR ESTE')}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAbierto(desplegado ? null : t.trazado_id)}
                      className={`p-2 rounded border transition-colors ${
                        desplegado
                          ? 'border-blue-500 text-blue-400'
                          : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                      }`}
                      title="Imagen del trazado"
                    >
                      <ImageIcon size={15}/>
                    </button>

                    <button
                      type="button" onClick={() => borrar(t)} disabled={trabajando}
                      className="p-2 rounded border border-neutral-800 text-neutral-500 hover:border-red-600 hover:text-red-500 disabled:opacity-40 transition-colors"
                      title="Borrar trazado"
                    >
                      {trabajando ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
                    </button>
                  </div>
                </div>

                {desplegado && (
                  <div className="border-t border-neutral-800 p-4 space-y-4">

                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                        {t('Desde este equipo')}
                      </p>
                      <input
                        type="file" accept="image/*"
                        ref={el => { inputs.current[t.trazado_id] = el }}
                        onChange={e => subir(t, e.target.files?.[0])}
                        className="hidden"
                      />
                      <button
                        type="button" disabled={trabajando}
                        onClick={() => inputs.current[t.trazado_id]?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors font-bold text-sm"
                      >
                        {trabajando ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
                        ELEGIR IMAGEN
                      </button>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                        {t('O por ruta en el servidor')}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text" spellCheck={false}
                          value={rutas[t.trazado_id] || ''}
                          onChange={e => setRutas(p => ({ ...p, [t.trazado_id]: e.target.value }))}
                          placeholder="C:/imagenes/pista-corta.jpg"
                          className="flex-1 bg-[#0a0a0a] border border-neutral-800 rounded p-2.5 font-mono text-sm focus:border-red-600 focus:outline-none text-white"
                        />
                        <button
                          type="button" onClick={() => traer(t)}
                          disabled={trabajando || !(rutas[t.trazado_id] || '').trim()}
                          className="flex items-center justify-center gap-2 bg-white text-black font-bold py-2.5 px-5 rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                        >
                          {t('TRAER')}
                        </button>
                      </div>
                    </div>

                    {/* Se dice de dónde sale cada cosa porque son dos sitios
                        distintos: el de arriba es tu equipo, el de abajo el
                        disco de la máquina donde corre el backend. */}
                    <p className="text-xs text-neutral-600">
                      La imagen se copia dentro de la plantilla de CasparCG, así que
                      luego puedes mover o borrar el original sin romper el gráfico.
                    </p>

                    {imagen && (
                      <div className="rounded-lg border border-neutral-800 bg-[#0a0a0a] p-3">
                        <img src={imagen} alt="Trazado" className="max-h-52 mx-auto object-contain"/>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
