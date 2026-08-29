import { useEffect, useState } from 'react'
import { Calendar, Tag, Users, Car, Download, Loader2 } from 'lucide-react'
import { exportAllToJSON } from '../utils/exportJSON'
import { categoriasApi, pilotosApi, vehiculosApi } from '../api/registro'
import { useToast } from '../context/ToastContext'
import { useDisciplina } from '../context/DisciplinaContext'

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

export default function HomeModule({ eventos = [] }) {
  const toast = useToast()
  const { disciplina, etiqueta } = useDisciplina()
  const [totales,  setTotales]  = useState({ p: 0, v: 0, c: 0 })
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)

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
    ])
      .then(([p, v, c]) => {
        if (vigente) setTotales({ p: p.total, v: v.total, c: c.total })
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
      const [pilotos, vehiculos, categorias] = await Promise.all([
        pilotosApi.listar({ sort_by: 'last_name', discipline: disciplina }),
        vehiculosApi.listar({ sort_by: 'number', discipline: disciplina }),
        categoriasApi.listar({ sort_by: 'category_name', discipline: disciplina }),
      ])
      exportAllToJSON({
        eventos,
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

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="bg-[#141414] rounded-2xl p-8 border border-neutral-800 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-600/10 rotate-45 transform" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 relative z-10">
          <div>
            <h3 className="text-3xl font-black italic mb-2">PANEL DE CONTROL</h3>
            <p className="text-neutral-400">
              Mostrando <span className="text-red-400 font-bold">{etiqueta}</span>.
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
          <StatCard icon={<Calendar />} title="Eventos"    count={eventos.length} />
          <StatCard icon={<Tag />}      title="Categorías" count={totales.c} cargando={cargando} />
          <StatCard icon={<Users />}    title="Pilotos"    count={totales.p} cargando={cargando} />
          <StatCard icon={<Car />}      title="Vehículos"  count={totales.v} cargando={cargando} />
        </div>
      </div>

      <div className="bg-[#141414] border border-neutral-800 rounded-xl px-6 py-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <p className="text-neutral-400 text-sm">
          <span className="text-white font-semibold">EXPORTAR TODO</span> genera un único archivo{' '}
          <span className="text-green-400 font-semibold">.json</span> con una sección por modulo:
          Eventos, Categorías, Pilotos y Vehículos.
        </p>
      </div>
    </div>
  )
}
