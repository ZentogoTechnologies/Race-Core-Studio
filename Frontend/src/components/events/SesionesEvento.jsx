import { t } from '../../i18n'
import { useState } from 'react'
import { Plus, X, Timer, Flag, Trophy, Loader2 } from 'lucide-react'
import { agregarSesion, quitarSesion } from '../../api/registro'
import { useToast } from '../../context/ToastContext'

const TIPOS = [
  { valor: 'practice', etiqueta: 'Practice', Icon: Timer,  color: 'text-blue-400' },
  { valor: 'qualy',    etiqueta: 'Qualy',    Icon: Flag,   color: 'text-yellow-400' },
  { valor: 'heat',     etiqueta: 'Heat',     Icon: Trophy, color: 'text-red-400' },
]

const ESTILO_TIPO = {
  practice: 'text-blue-400 bg-blue-500/10',
  qualy:    'text-yellow-400 bg-yellow-500/10',
  heat:     'text-red-400 bg-red-600/10',
}

// El día viene como YYYY-MM-DD. Se parte a mano en vez de usar new Date():
// interpretar esa cadena como UTC y mostrarla en horario local corre la
// fecha un día hacia atrás en husos al oeste, que es el caso de Panamá.
function rotularDia(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  const fecha = new Date(a, m - 1, d)
  const texto = fecha.toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Programa de un evento, día por día.
 *
 * El número de cada sesión lo pone el servidor: cuenta cuántas lleva esa
 * categoría en el evento. Aquí no se calcula nada, se muestra lo que
 * devuelve para que no haya dos versiones de la misma cuenta.
 */
export default function SesionesEvento({ evento, onCambio, puedeEscribir }) {
  const toast = useToast()

  const [diaAbierto, setDiaAbierto] = useState(null)
  const [tipo, setTipo] = useState('practice')
  const [libre, setLibre] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)

  const nombreCategoria = (id) =>
    evento.categorias[evento.category_ids.indexOf(id)] || `#${id}`

  const abrir = (dia) => {
    setDiaAbierto(dia)
    setTipo('practice')
    setLibre(false)
    setCategorias([])
  }

  const alternarCategoria = (id) => {
    setCategorias(actual => {
      // Fuera de la práctica libre solo corre una categoría, así que
      // elegir otra reemplaza en vez de sumar.
      if (!libre) return actual.includes(id) ? [] : [id]
      return actual.includes(id) ? actual.filter(c => c !== id) : [...actual, id]
    })
  }

  const cambiarLibre = (valor) => {
    setLibre(valor)
    // Al pasar a normal, quedarse con varias categorías haría que el
    // servidor rechace la sesión; se deja solo la primera.
    setCategorias(actual => (valor ? actual : actual.slice(0, 1)))
    if (valor) setTipo('practice')
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const actualizado = await agregarSesion(evento.event_id, {
        dia: diaAbierto, tipo, category_ids: categorias, libre,
      })
      const nueva = actualizado.sesiones[actualizado.sesiones.length - 1]
      toast.exito('Sesión agregada', nueva?.nombre)
      setDiaAbierto(null)
      onCambio(actualizado)
    } catch (err) {
      toast.error('No se pudo agregar la sesión', err.message)
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (sesion) => {
    try {
      const actualizado = await quitarSesion(evento.event_id, sesion.numero_orden)
      toast.exito('Sesión eliminada', sesion.nombre)
      onCambio(actualizado)
    } catch (err) {
      toast.error('No se pudo eliminar', err.message)
    }
  }

  const valido = libre ? categorias.length >= 2 : categorias.length === 1

  return (
    <div className="flex flex-col gap-3">
      {evento.dias.map(dia => {
        const delDia = evento.sesiones.filter(s => s.dia === dia)

        return (
          <div key={dia} className="bg-[#0a0a0a] border border-neutral-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/60">
              <div>
                <p className="text-sm font-bold text-white">{rotularDia(dia)}</p>
                <p className="text-[11px] text-neutral-600 font-mono">{dia}</p>
              </div>
              {puedeEscribir && (
                <button
                  onClick={() => (diaAbierto === dia ? setDiaAbierto(null) : abrir(dia))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 transition-colors text-xs font-bold"
                >
                  {diaAbierto === dia ? <X size={14}/> : <Plus size={14}/>}
                  {diaAbierto === dia ? 'CANCELAR' : 'AGREGAR SESIÓN'}
                </button>
              )}
            </div>

            {diaAbierto === dia && (
              <div className="px-4 py-4 border-b border-neutral-800/60 bg-[#141414]">
                <div className="flex flex-wrap gap-2 mb-4">
                  {TIPOS.map(({ valor, etiqueta, Icon, color }) => (
                    <button
                      key={valor} type="button"
                      onClick={() => { setTipo(valor); if (valor !== 'practice') cambiarLibre(false) }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-colors ${
                        tipo === valor
                          ? 'border-red-600 bg-red-600/10 text-white'
                          : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'
                      }`}
                    >
                      <Icon size={14} className={tipo === valor ? color : ''}/>{t(etiqueta)}
                    </button>
                  ))}

                  {tipo === 'practice' && (
                    <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 text-xs font-bold text-neutral-400 cursor-pointer hover:border-neutral-600">
                      <input
                        type="checkbox" checked={libre}
                        onChange={e => cambiarLibre(e.target.checked)}
                        className="accent-red-600"
                      />
                      {t('PRÁCTICA LIBRE')}
                    </label>
                  )}
                </div>

                <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                  {libre ? 'Categorías que salen juntas (mínimo dos)' : 'Categoría'}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {evento.category_ids.map(id => {
                    const activa = categorias.includes(id)
                    return (
                      <button
                        key={id} type="button"
                        onClick={() => alternarCategoria(id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          activa
                            ? 'bg-red-600/15 border-red-600 text-red-400'
                            : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                        }`}
                      >
                        {nombreCategoria(id)}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-600">
                    El número lo asigna el sistema según lo que ya lleve la categoría.
                  </p>
                  <button
                    onClick={guardar} disabled={!valido || guardando}
                    className="bg-white text-black font-bold py-2 px-6 rounded text-sm hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {guardando && <Loader2 size={14} className="animate-spin"/>}
                    AGREGAR
                  </button>
                </div>
              </div>
            )}

            {delDia.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-600">{t('Sin sesiones programadas.')}</p>
            ) : (
              <div className="divide-y divide-neutral-800/50">
                {delDia.map(s => (
                  <div key={s.numero_orden} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${ESTILO_TIPO[s.tipo]}`}>
                      {s.libre ? 'LIBRE' : s.tipo.toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm text-white font-semibold">{s.nombre}</span>
                    {puedeEscribir && (
                      <button
                        onClick={() => borrar(s)}
                        className="p-1.5 rounded text-neutral-600 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        aria-label={t('Quitar sesión')}
                      >
                        <X size={14}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
