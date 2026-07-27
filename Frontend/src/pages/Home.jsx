import { Calendar, Tag, Users, Car, Download } from 'lucide-react'
import { exportAllToExcel } from '../utils/exportExcel'

// ==========================================
// 📁 src/pages/Home.jsx
// ==========================================

function StatCard({ icon, title, count }) {
  return (
    <div className="bg-[#0a0a0a] p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
      <div className="bg-red-600/10 w-fit p-3 rounded-lg text-red-500 mb-4">{icon}</div>
      <div>
        <p className="text-3xl font-black text-white">{count}</p>
        <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
    </div>
  )
}

export default function HomeModule({ eventType, stats, allData }) {
  const handleExportAll = () => {
    exportAllToExcel(allData)
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="bg-[#141414] rounded-2xl p-8 border border-neutral-800 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-600/10 rotate-45 transform" />

        {/* Título + Botón exportar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 relative z-10">
          <div>
            <h3 className="text-3xl font-black italic mb-2">PANEL DE CONTROL</h3>
            <p className="text-neutral-400">
              Estás gestionando el modo{' '}
              <span className="text-red-500 font-bold uppercase">{eventType}</span>.
              Selecciona un módulo para administrar los registros.
            </p>
          </div>

          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-green-600/40 bg-green-600/5 text-green-400 hover:bg-green-600/15 hover:border-green-500 transition-all font-bold text-sm whitespace-nowrap flex-shrink-0"
          >
            <Download size={18} />
            EXPORTAR TODO
          </button>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 relative z-10">
          <StatCard icon={<Calendar />} title="Eventos"    count={stats.e} />
          <StatCard icon={<Tag />}      title="Categorías" count={stats.c} />
          <StatCard icon={<Users />}    title="Pilotos"    count={stats.p} />
          <StatCard icon={<Car />}      title="Vehículos"  count={stats.v} />
        </div>
      </div>

      {/* Nota informativa */}
      <div className="bg-[#141414] border border-neutral-800 rounded-xl px-6 py-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <p className="text-neutral-400 text-sm">
          <span className="text-white font-semibold">EXPORTAR TODO</span> genera un único archivo{' '}
          <span className="text-green-400 font-semibold">.xlsx</span> con una pestaña por sección:
          Eventos, Categorías, Pilotos y Vehículos.
        </p>
      </div>
    </div>
  )
}
