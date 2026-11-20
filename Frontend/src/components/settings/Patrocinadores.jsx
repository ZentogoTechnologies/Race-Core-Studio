import { t } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, ChevronUp, FolderUp, Loader2, Megaphone, Trash2, Upload,
} from 'lucide-react'
import {
  leerPatrocinadores, ordenarPatrocinadores, quitarPatrocinador,
  ritmoPatrocinadores, subirPatrocinadores, urlPatrocinador,
} from '../../api/registro'
import { useToast } from '../../context/ToastContext'

/**
 * Logos de los patrocinadores.
 *
 * Van aquí, junto al logo del autódromo, porque son lo mismo: material
 * del cliente que vale para todo el evento, no datos de una carrera. Los
 * archivos se guardan en public/, que es lo único que sobrevive a una
 * actualización del programa.
 *
 * El orden se guarda y no se deduce de la carpeta: quien paga más sale
 * primero, y el disco no sabe de eso.
 *
 * Esto solo los administra. Para que salgan en pantalla hay que sacar el
 * gráfico de Patrocinadores en Gráficos → General, y una vez puesto se
 * queda solo: tiene capa propia y ningún otro gráfico lo tumba.
 */
export default function Patrocinadores() {
  const toast = useToast()

  const [lista, setLista]       = useState([])
  const [segundos, setSegundos] = useState(6)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const entrada = useRef(null)
  const carpeta = useRef(null)

  // Las cuatro llamadas devuelven la lista entera ya ordenada, así que
  // la pantalla nunca la recompone por su cuenta y no puede quedar
  // diciendo un orden distinto del que saldrá al aire.
  const aplicar = (r) => {
    setLista(r.patrocinadores || [])
    setSegundos(r.segundos ?? 6)
  }

  useEffect(() => {
    leerPatrocinadores()
      .then(aplicar)
      .catch(e => toast.error(e.message))
      .finally(() => setCargando(false))
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // Vale para un archivo, para varios y para una carpeta entera: en
  // los tres casos llega una lista. Una carpeta del escritorio trae
  // además lo suyo —Thumbs.db, .DS_Store—, así que se filtra por tipo
  // antes de mandar nada y no se gasta la subida en basura.
  const subir = async (seleccion) => {
    const archivos = [...(seleccion || [])].filter(a => a.type.startsWith('image/'))

    const limpiar = () => {
      if (entrada.current) entrada.current.value = ''
      if (carpeta.current) carpeta.current.value = ''
    }

    if (!archivos.length) {
      if (seleccion?.length) toast.error(t('No había ninguna imagen ahí'))
      limpiar()
      return
    }

    setSubiendo(true)
    try {
      const r = await subirPatrocinadores(archivos)
      aplicar(r)

      const n = r.anadidos ?? archivos.length
      const fuera = r.rechazados?.length || 0
      toast.exito(
        n === 1 ? t('Patrocinador añadido') : `${n} ${t('patrocinadores añadidos')}`,
        // Se dicen los que no entraron, pero sin alarmar: los demás sí
        // están puestos y eso es lo que importa.
        fuera ? `${fuera} ${t('no se pudieron leer como imagen')}` : undefined,
      )
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubiendo(false)
      limpiar()
    }
  }

  const quitar = async (nombre) => {
    try {
      aplicar(await quitarPatrocinador(nombre))
    } catch (e) { toast.error(e.message) }
  }

  // Intercambia con el de al lado. Se manda la lista entera y no "sube
  // este": el backend fija el orden que reciba, y así los dos lados no
  // pueden discrepar sobre cuál era la posición de partida.
  const mover = async (desde, hacia) => {
    if (hacia < 0 || hacia >= lista.length) return

    const nombres = lista.map(p => p.nombre)
    ;[nombres[desde], nombres[hacia]] = [nombres[hacia], nombres[desde]]

    try {
      aplicar(await ordenarPatrocinadores(nombres))
    } catch (e) { toast.error(e.message) }
  }

  const cambiarRitmo = async (valor) => {
    const n = Number(valor)
    if (!Number.isFinite(n)) return
    setSegundos(n)
    try {
      aplicar(await ritmoPatrocinadores(n))
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone size={17} className="text-neutral-500" />
        <h3 className="text-lg font-black italic text-white">{t('PATROCINADORES')}</h3>
      </div>
      <p className="text-neutral-500 text-sm mb-5">
        {t('Rotan en la esquina superior derecha junto al logo del autódromo, sin parar mientras el gráfico esté al aire. Se guardan en PNG con transparencia, porque van sobre la imagen de la carrera.')}
      </p>

      {/* ── Ritmo ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-neutral-800">
        <label htmlFor="pa-segundos" className="text-sm text-neutral-400">
          {t('Cada uno dura')}
        </label>
        <input
          id="pa-segundos" type="number" min="2" max="60"
          value={segundos}
          onChange={e => setSegundos(e.target.value)}
          onBlur={e => cambiarRitmo(e.target.value)}
          className="w-20 bg-[#0a0a0a] border border-neutral-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-red-600 transition-colors"
        />
        <span className="text-sm text-neutral-400">{t('segundos en pantalla')}</span>
      </div>

      {/* ── La lista, en el orden en que rotan ── */}
      {cargando ? (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={15} className="animate-spin" /> {t('Cargando…')}
        </div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-neutral-600 mb-5">
          {t('Todavía no hay ninguno. Con la lista vacía, el gráfico enseña solo el logo del autódromo.')}
        </p>
      ) : (
        <div className="space-y-2 mb-5">
          {lista.map((p, i) => (
            <div
              key={p.nombre}
              className="flex items-center gap-3 bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2"
            >
              <span className="w-6 shrink-0 text-center text-xs font-mono text-neutral-600">{i + 1}</span>

              {/* Fondo a cuadros, igual que el del logo del autódromo:
                  un PNG con fondo blanco se delata aquí y no al aire. */}
              <div
                className="w-20 h-12 rounded border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,#1a1a1a 25%,transparent 25%),' +
                    'linear-gradient(-45deg,#1a1a1a 25%,transparent 25%),' +
                    'linear-gradient(45deg,transparent 75%,#1a1a1a 75%),' +
                    'linear-gradient(-45deg,transparent 75%,#1a1a1a 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                  backgroundColor: '#0a0a0a',
                }}
              >
                <img src={urlPatrocinador(p.url)} alt="" className="max-w-full max-h-full object-contain" />
              </div>

              <span className="flex-1 min-w-0 text-sm text-neutral-300 truncate">{p.nombre}</span>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button" onClick={() => mover(i, i - 1)} disabled={i === 0}
                  title={t('Subir en la lista')}
                  className="p-1.5 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button" onClick={() => mover(i, i + 1)} disabled={i === lista.length - 1}
                  title={t('Bajar en la lista')}
                  className="p-1.5 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button" onClick={() => quitar(p.nombre)}
                  title={t('Quitar')}
                  className="p-1.5 rounded text-neutral-600 hover:text-red-500 hover:bg-red-600/10 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        type="file" accept="image/*" multiple ref={entrada} className="hidden"
        onChange={e => subir(e.target.files)}
      />
      {/* webkitdirectory lo entienden Chrome, Edge y Safari, que es
          donde corre esto. En React va en minúsculas y como cadena o no
          llega al DOM. */}
      <input
        type="file" ref={carpeta} className="hidden"
        webkitdirectory="" directory=""
        onChange={e => subir(e.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button" disabled={subiendo}
          onClick={() => entrada.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors font-bold text-sm"
        >
          {subiendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {t('AÑADIR IMÁGENES')}
        </button>

        <button
          type="button" disabled={subiendo}
          onClick={() => carpeta.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors font-bold text-sm"
        >
          <FolderUp size={16} />
          {t('SUBIR UNA CARPETA')}
        </button>
      </div>

      <p className="text-xs text-neutral-600 mt-3">
        {t('Para que salgan en pantalla, saca el gráfico de Patrocinadores en Gráficos → General. Lo que subas con el gráfico ya puesto entra en la rotación solo, sin tener que bajarlo.')}
      </p>
    </div>
  )
}
