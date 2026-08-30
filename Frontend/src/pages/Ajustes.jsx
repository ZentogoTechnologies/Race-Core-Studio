import { useEffect, useState } from 'react'
import {
  Loader2, CheckCircle2, AlertCircle, FolderSearch, Save, FlaskConical,
} from 'lucide-react'
import { guardarRutaXml, leerAjustes, probarRutaXml } from '../api/registro'
import Trazados from '../components/settings/Trazados'
import { useToast } from '../context/ToastContext'

export default function AjustesModule() {
  const toast = useToast()

  const [cargando,  setCargando]  = useState(true)
  const [ruta,      setRuta]      = useState('')
  const [aplicada,  setAplicada]  = useState('')
  const [estado,    setEstado]    = useState(null)   // estado de la ruta aplicada
  const [prueba,    setPrueba]    = useState(null)   // resultado de "probar"
  const [detectados, setDetectados] = useState([])
  const [probando,  setProbando]  = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    leerAjustes()
      .then(a => {
        setRuta(a.timing_xml_path || '')
        setAplicada(a.timing_xml_path || '')
        setEstado(a.estado)
        setDetectados(a.detectados || [])
      })
      .catch(err => toast.error('No se pudieron cargar los ajustes', err.message))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const probar = async () => {
    setProbando(true)
    setPrueba(null)
    try {
      setPrueba(await probarRutaXml(ruta))
    } catch (err) {
      setPrueba({ ok: false, detalle: err.message })
    } finally {
      setProbando(false)
    }
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const r = await guardarRutaXml(ruta)
      setAplicada(r.timing_xml_path)
      setEstado(r.estado)
      setPrueba(null)
      toast.exito(
        'Ruta aplicada',
        r.estado?.ok ? `${r.estado.evento || 'archivo leído'} · ${r.estado.tanda || ''}`.trim()
                     : 'guardada, pero el archivo no se pudo leer',
      )
    } catch (err) {
      toast.error('No se pudo guardar', err.message)
    } finally {
      setGuardando(false)
    }
  }

  const sinCambios = ruta.trim() === (aplicada || '').trim()

  const Diagnostico = ({ r, titulo }) => {
    if (!r) return null
    return (
      <div className={`flex items-start gap-3 rounded-lg px-4 py-3 border ${
        r.ok ? 'border-green-600/40 bg-green-600/5' : 'border-red-600/40 bg-red-600/5'
      }`}>
        {r.ok
          ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5"/>
          : <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>}
        <div className="min-w-0">
          {titulo && <p className="text-xs uppercase tracking-wider text-neutral-500 mb-0.5">{titulo}</p>}
          <p className={`text-sm font-bold ${r.ok ? 'text-green-400' : 'text-red-400'}`}>{r.detalle}</p>
          {r.ok && (
            <p className="text-xs text-neutral-500 mt-1">
              {[r.evento, r.tanda, r.grupo].filter(Boolean).join(' · ')}
              {r.filas != null && ` · ${r.filas} líneas`}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="w-full py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600"/>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl animate-fade-in space-y-6">

      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">
        <h3 className="text-lg font-black italic text-white mb-1">CRONOMETRAJE</h3>
        <p className="text-neutral-500 text-sm mb-5">
          Archivo que MyLaps reescribe con la clasificación en vivo. El backend lo relee
          varias veces por segundo mientras hay una tanda en pista.
        </p>

        <label className="block text-neutral-400 text-xs mb-2 uppercase">
          Ruta del current.xml
        </label>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text" value={ruta}
            onChange={e => { setRuta(e.target.value); setPrueba(null) }}
            placeholder="W:/XML/current.xml"
            spellCheck={false}
            className="flex-1 bg-[#0a0a0a] border border-neutral-800 rounded p-2.5 font-mono text-sm focus:border-red-600 focus:outline-none text-white"
          />
          <button
            onClick={probar} disabled={probando || !ruta.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-sm whitespace-nowrap"
          >
            {probando ? <Loader2 size={16} className="animate-spin"/> : <FlaskConical size={16}/>}
            PROBAR
          </button>
          <button
            onClick={guardar} disabled={guardando || sinCambios}
            className="flex items-center justify-center gap-2 bg-white text-black font-bold py-2.5 px-5 rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
          >
            {guardando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            APLICAR
          </button>
        </div>

        {/* La ruta se escribe, no se examina: el navegador solo entrega el
            nombre del archivo y nunca su ruta en disco, y quien lee el XML
            es el backend, que puede estar en otra máquina. */}
        <p className="text-xs text-neutral-600 mb-5">
          Es una ruta del servidor donde corre el backend, no de tu equipo.
        </p>

        <div className="space-y-3">
          <Diagnostico r={prueba} titulo="Prueba (sin aplicar)" />
          {!prueba && <Diagnostico r={estado} titulo="Ruta en uso" />}
        </div>
      </div>

      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderSearch size={17} className="text-neutral-500"/>
          <h3 className="text-lg font-black italic text-white">ARCHIVOS DETECTADOS</h3>
        </div>
        <p className="text-neutral-500 text-sm mb-4">
          XML que el servidor alcanza ahora mismo. Pulsa uno para ponerlo en el campo de arriba.
        </p>

        <div className="flex flex-col gap-2">
          {detectados.map(d => {
            const enUso = d.ruta === aplicada
            return (
              <button
                key={d.ruta}
                onClick={() => { setRuta(d.ruta); setPrueba(null) }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                  enUso ? 'border-red-600/60 bg-red-600/5' : 'border-neutral-800 hover:border-neutral-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.existe ? 'bg-green-500' : 'bg-red-600'}`}/>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white">{d.nombre}</span>
                  <span className="block text-[11px] text-neutral-600 font-mono truncate">{d.ruta}</span>
                </span>
                {enUso && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-600/15 text-red-400 flex-shrink-0">
                    EN USO
                  </span>
                )}
                {!d.existe && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-700/30 text-neutral-500 flex-shrink-0">
                    NO ALCANZABLE
                  </span>
                )}
              </button>
            )
          })}
          {detectados.length === 0 && (
            <p className="text-sm text-neutral-600">El servidor no encuentra ningún XML.</p>
          )}
        </div>
      </div>

      <Trazados />

    </div>
  )
}
