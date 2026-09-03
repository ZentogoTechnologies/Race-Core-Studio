import { t } from '../../i18n'
import { useEffect, useState } from 'react'
import {
  CalendarDays, ChevronRight, Loader2, SkipForward, Timer, Flag, Trophy, Radio,
} from 'lucide-react'
import { eventosApi } from '../../api/registro'
import { useCarrera } from '../../context/CarreraContext'
import { useDisciplina } from '../../context/DisciplinaContext'
import { useToast } from '../../context/ToastContext'

const ICONO_TIPO = { practice: Timer, qualy: Flag, heat: Trophy }

const ESTILO_TIPO = {
  practice: 'text-blue-400 bg-blue-500/10',
  qualy:    'text-yellow-400 bg-yellow-500/10',
  heat:     'text-red-400 bg-red-600/10',
}

/**
 * Primera pantalla de Gráficos: qué se va a graficar.
 *
 * Se pregunta antes de mostrar la botonera porque casi todo lo que hay
 * detrás depende de ello: las fichas salen de los pilotos inscritos, la
 * grilla de los vehículos del evento y el cuadro de resultados lleva el
 * nombre de la tanda. Sin esa referencia, esos gráficos saldrían al aire
 * sin saber a qué carrera pertenecen.
 */
export default function SelectorCarrera() {
  const toast = useToast()
  const { disciplina } = useDisciplina()
  const { elegir, omitir } = useCarrera()

  const [eventos,  setEventos]  = useState([])
  const [cargando, setCargando] = useState(true)
  const [abierto,  setAbierto]  = useState(null)   // evento desplegado

  useEffect(() => {
    eventosApi.listar({ discipline: disciplina, sort_by: 'start_date', sort_dir: 'desc' })
      .then(p => {
        setEventos(p.items)
        // Con un solo evento se abre directamente: obligar a un clic de
        // más para llegar a lo único que hay es puro estorbo.
        if (p.items.length === 1) setAbierto(p.items[0].event_id)
      })
      .catch(err => toast.error('No se pudieron cargar los eventos', err.message))
      .finally(() => setCargando(false))
  }, [disciplina])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in py-6">

      <div className="text-center mb-8">
        <div className="bg-red-600/10 w-fit p-3 rounded-xl text-red-500 mx-auto mb-4">
          <Radio size={26} />
        </div>
        <h2 className="text-2xl font-black italic text-white mb-2">
          ¿QUÉ VAS A GRAFICAR?
        </h2>
        <p className="text-neutral-500 text-sm">
          Elige el evento y, si quieres, la tanda concreta. Puedes cambiarlo después.
        </p>
      </div>

      {cargando && (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600"/>
        </div>
      )}

      {!cargando && eventos.length === 0 && (
        <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6 text-center mb-4">
          <p className="text-neutral-400 text-sm">
            {t('No hay eventos registrados en esta disciplina.')}
          </p>
          <p className="text-neutral-600 text-xs mt-1">
            Créalos desde el módulo de Eventos, o continúa sin carrera.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-6">
        {eventos.map(ev => {
          const desplegado = abierto === ev.event_id

          return (
            <div
              key={ev.event_id}
              className={`bg-[#141414] border rounded-xl overflow-hidden transition-colors ${
                desplegado ? 'border-red-600/60' : 'border-neutral-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setAbierto(desplegado ? null : ev.event_id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black italic text-white text-lg truncate">{ev.name}</p>
                  <p className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
                    <CalendarDays size={12} className="text-red-500"/>
                    {ev.start_date} → {ev.end_date}
                    <span className="text-neutral-700">·</span>
                    {ev.total_sesiones} tanda{ev.total_sesiones === 1 ? '' : 's'}
                  </p>
                  {ev.categorias.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ev.categorias.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[11px] rounded font-bold">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  className={`text-neutral-600 flex-shrink-0 transition-transform ${desplegado ? 'rotate-90' : ''}`}
                />
              </button>

              {desplegado && (
                <div className="border-t border-neutral-800 px-5 py-4">
                  {ev.sesiones.length === 0 ? (
                    <p className="text-sm text-neutral-600 mb-4">
                      {t('Este evento aún no tiene tandas programadas.')}
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                        {t('Tanda')}
                      </p>
                      <div className="flex flex-col gap-2 mb-4 max-h-56 overflow-y-auto">
                        {ev.sesiones.map(s => {
                          const Icon = ICONO_TIPO[s.tipo] || Timer
                          return (
                            <button
                              key={s.numero_orden} type="button"
                              onClick={() => elegir(ev, s)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-neutral-800 hover:border-red-600 hover:bg-red-600/5 transition-colors text-left"
                            >
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${ESTILO_TIPO[s.tipo]}`}>
                                <Icon size={11} className="inline mr-1"/>
                                {s.libre ? 'LIBRE' : s.tipo.toUpperCase()}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-bold text-white truncate">{s.nombre}</span>
                                <span className="block text-[11px] text-neutral-600 font-mono">{s.dia}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Se puede graficar el evento sin fijar tanda: en una
                      jornada larga la tanda cambia sola en el cronometraje
                      y no siempre hace falta clavarla aquí. */}
                  <button
                    type="button"
                    onClick={() => elegir(ev, null)}
                    className="w-full bg-white text-black font-bold py-2.5 rounded-lg hover:bg-neutral-200 transition-colors text-sm"
                  >
                    GRAFICAR ESTE EVENTO {ev.sesiones.length > 0 && '(sin fijar tanda)'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Salida de emergencia. Deja entrar, pero con casi todo cerrado:
          fondos y misceláneos no dependen de ninguna carrera. */}
      <div className="border-t border-neutral-800 pt-5">
        <button
          type="button"
          onClick={omitir}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors font-bold text-sm"
        >
          <SkipForward size={16}/>
          {t('AVANZAR SIN CARRERA SELECCIONADA')}
        </button>
        <p className="text-xs text-neutral-600 text-center mt-2">
          {t('Solo quedará disponible la pestaña')} <span className="text-neutral-400 font-bold">{t('General')}</span>:
          fondos y misceláneos. Carrera, Pilotos y Grilla necesitan saber qué se está corriendo.
        </p>
      </div>

    </div>
  )
}
