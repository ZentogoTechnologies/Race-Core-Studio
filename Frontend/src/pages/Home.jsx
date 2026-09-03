import { t } from '../i18n'
import { useEffect, useState } from 'react'
import { Calendar, Tag, Users, Car, Download, Loader2, Power, AlertTriangle } from 'lucide-react'
import { exportAllToJSON } from '../utils/exportJSON'
import { apagarSistema, categoriasApi, eventosApi, pilotosApi, vehiculosApi } from '../api/registro'
import { useToast } from '../context/ToastContext'
import { useDisciplina } from '../context/DisciplinaContext'
import { useAuth } from '../context/AuthContext'

function StatCard({ icon, title, count, cargando }) {
  return (
    <div className="bg-[#0a0a0a] p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
      <div className="bg-red-600/10 w-fit p-3 rounded-lg text-red-500 mb-4">{icon}</div>
      <div>
        <p className="text-3xl font-black text-white">
          {cargando ? <Loader2 className="w-6 h-6 animate-spin text-neutral-700"/> : count}
        </p>
        <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
    </div>
  )
}

export default function HomeModule() {
  const toast = useToast()
  const { disciplina, etiqueta } = useDisciplina()
  const { puedeEscribir } = useAuth()
  const [totales,  setTotales]  = useState({ p: 0, v: 0, c: 0, e: 0 })
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [apagando,    setApagando]    = useState(false)
  const [apagado,     setApagado]     = useState(null)

  // Para los contadores basta con el `total` del sobre: se pide una sola
  // fila de cada listado en vez de traerse los 111 pilotos completos.
  useEffect(() => {
    let vigente = true

    // Los contadores llevan la misma disciplina que los módulos. Sin esto
    // el panel diría 111 pilotos y la pantalla de Pilotos mostraría otra
    // cifra, y no habría forma de saber cuál es la buena.
    Promise.all([
      pilotosApi.listar({ limit: 1, discipline: disciplina }),
      vehiculosApi.listar({ limit: 1, discipline: disciplina }),
      categoriasApi.listar({ limit: 1, discipline: disciplina }),
      eventosApi.listar({ limit: 1, discipline: disciplina }),
    ])
      .then(([p, v, c, e]) => {
        if (vigente) setTotales({ p: p.total, v: v.total, c: c.total, e: e.total })
      })
      .catch(err => {
        if (vigente) toast.error('No se pudieron cargar los totales', err.message)
      })
      .finally(() => { if (vigente) setCargando(false) })

    return () => { vigente = false }
  }, [disciplina])   // eslint-disable-line react-hooks/exhaustive-deps

  // La exportación sí necesita los registros completos, así que se piden
  // recién al pulsar el botón y no al entrar al panel.
  const exportarTodo = async () => {
    setExportando(true)
    try {
      const [pilotos, vehiculos, categorias, eventos] = await Promise.all([
        pilotosApi.listar({ sort_by: 'last_name', discipline: disciplina }),
        vehiculosApi.listar({ sort_by: 'number', discipline: disciplina }),
        categoriasApi.listar({ sort_by: 'category_name', discipline: disciplina }),
        eventosApi.listar({ sort_by: 'start_date', discipline: disciplina }),
      ])
      exportAllToJSON({
        eventos: eventos.items,
        categorias: categorias.items,
        pilotos: pilotos.items,
        vehiculos: vehiculos.items,
      })
      toast.exito('Exportación lista', 'Se descargó el archivo .json')
    } catch (err) {
      toast.error('No se pudo exportar', err.message)
    } finally {
      setExportando(false)
    }
  }

  const detenerTodo = async () => {
    setConfirmando(false)
    setApagando(true)

    try {
      const r = await apagarSistema()
      // No se recarga ni se navega: el backend acaba de cerrarse y el
      // servidor del frontend también. La página que ya está en memoria
      // es lo único que queda para contar qué pasó.
      setApagado(r.servicios)
    } catch (err) {
      // Un corte de conexión aquí suele significar que sí se apagó y la
      // respuesta no alcanzó a llegar; se dice tal cual en vez de dar un
      // error que haría pulsar el botón otra vez.
      setApagado([{
        servicio: 'Sistema',
        estado: err.status === 0 ? 'deteniendo' : 'fallo',
        detalle: err.status === 0
          ? 'se perdió la conexión con el backend, que es lo esperado al apagarlo'
          : err.message,
      }])
    } finally {
      setApagando(false)
    }
  }

  // Con el sistema apagado no queda nada que mostrar del panel: la
  // pantalla se reemplaza por el resumen.
  if (apagado) {
    return (
      <div className="w-full animate-fade-in">
        <div className="bg-[#141414] rounded-2xl p-8 border border-neutral-800 max-w-2xl">
          <div className="bg-red-600/10 w-fit p-3 rounded-lg text-red-500 mb-5">
            <Power size={26} />
          </div>
          <h3 className="text-2xl font-black italic mb-2">{t('RACE CORE STUDIO DETENIDO')}</h3>
          <p className="text-neutral-400 text-sm mb-6">
            MongoDB sigue corriendo: es un servicio de Windows y no se detiene desde aquí.
          </p>

          <div className="flex flex-col gap-2 mb-6">
            {apagado.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#0a0a0a] border border-neutral-800 rounded-lg px-4 py-3">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                  s.estado === 'fallo' ? 'bg-red-600/15 text-red-400'
                    : s.estado === 'no_estaba' ? 'bg-neutral-700/30 text-neutral-500'
                    : 'bg-green-500/10 text-green-500'
                }`}>
                  {s.estado === 'fallo' ? 'FALLO'
                    : s.estado === 'no_estaba' ? 'NO ESTABA'
                    : s.estado === 'deteniendo' ? 'CERRANDO' : 'DETENIDO'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{s.servicio}</p>
                  <p className="text-xs text-neutral-500">{t(s.detalle)}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-neutral-500 text-sm">
            Para volver a levantarlo, ejecuta{' '}
            <span className="text-neutral-300 font-mono">race-core-studio.exe</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="bg-[#141414] rounded-2xl p-8 border border-neutral-800 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-600/10 rotate-45 transform" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 relative z-10">
          <div>
            <h3 className="text-3xl font-black italic mb-2">{t('PANEL DE CONTROL')}</h3>
            <p className="text-neutral-400">
              {t('Mostrando')} <span className="text-red-400 font-bold">{etiqueta}</span>.
              Selecciona un módulo del menú para administrar los registros.
            </p>
          </div>

          <button
            onClick={exportarTodo}
            disabled={exportando}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-green-600/40 bg-green-600/5 text-green-400 hover:bg-green-600/15 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm whitespace-nowrap flex-shrink-0"
          >
            {exportando ? <Loader2 size={18} className="animate-spin"/> : <Download size={18} />}
            EXPORTAR TODO
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 relative z-10">
          <StatCard icon={<Calendar />} title={t('Eventos')}    count={totales.e} cargando={cargando} />
          <StatCard icon={<Tag />}      title={t('Categorías')} count={totales.c} cargando={cargando} />
          <StatCard icon={<Users />}    title={t('Pilotos')}    count={totales.p} cargando={cargando} />
          <StatCard icon={<Car />}      title={t('Vehículos')}  count={totales.v} cargando={cargando} />
        </div>
      </div>

      <div className="bg-[#141414] border border-neutral-800 rounded-xl px-6 py-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <p className="text-neutral-400 text-sm">
          <span className="text-white font-semibold">{t('EXPORTAR TODO')}</span> genera un único archivo{' '}
          <span className="text-green-400 font-semibold">.json</span> con una sección por modulo:
          Eventos, Categorías, Pilotos y Vehículos.
        </p>
      </div>

      {/* Apagar el sistema entero es demasiado para un usuario estándar,
          que puede operar gráficos pero no escribir en la base. El backend
          responde 403 igual; esto solo evita ofrecer un botón que falla. */}
      {puedeEscribir && (
        <div className="bg-[#141414] border border-red-900/40 rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-sm mb-1">{t('Detener Race Core Studio')}</p>
            <p className="text-neutral-500 text-sm">
              Cierra CasparCG, el frontend y el backend. La base de datos sigue corriendo.
            </p>
          </div>

          <button
            onClick={() => setConfirmando(true)}
            disabled={apagando}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-red-600/50 bg-red-600/5 text-red-400 hover:bg-red-600/15 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm whitespace-nowrap flex-shrink-0"
          >
            {apagando ? <Loader2 size={18} className="animate-spin"/> : <Power size={18} />}
            {apagando ? 'DETENIENDO...' : 'DETENER RACE CORE STUDIO'}
          </button>
        </div>
      )}

      {/* Un clic de más aquí tumba los gráficos en mitad de una carrera,
          así que se pide confirmación diciendo exactamente qué se cae. */}
      {confirmando && (
        <div
          className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setConfirmando(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[#141414] border border-red-600/40 rounded-xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={22} />
              <div>
                <h3 className="font-bold text-white">{t('Detener Race Core Studio')}</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Si hay algo al aire, sale de pantalla en el momento.
                </p>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg px-4 py-3 mb-5 text-sm">
              <p className="text-neutral-300 mb-2 font-semibold">{t('Se detienen:')}</p>
              <ul className="text-neutral-500 space-y-1 mb-3">
                <li>· CasparCG — el servidor de gráficos</li>
                <li>· Frontend — este panel</li>
                <li>· Backend — el API</li>
              </ul>
              <p className="text-neutral-300 font-semibold">{t('Sigue corriendo:')}</p>
              <p className="text-neutral-500">· MongoDB — no se pierde ningún dato</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmando(false)}
                className="px-5 py-2 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors font-bold text-sm"
              >
                {t('CANCELAR')}
              </button>
              <button
                onClick={detenerTodo}
                className="px-5 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors"
              >
                {t('DETENER TODO')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
