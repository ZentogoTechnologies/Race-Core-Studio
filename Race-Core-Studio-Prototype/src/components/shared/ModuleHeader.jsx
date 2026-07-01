import { Search, Plus, X, Download } from 'lucide-react'
import { exportToExcel } from '../../utils/exportExcel'

// ==========================================
// 📁 src/components/shared/ModuleHeader.jsx
// ==========================================
export default function ModuleHeader({
  title,
  search,
  setSearch,
  showForm,
  setShowForm,
  btnText,
  exportData,
  exportFilename,
  exportColumns,
}) {
  const handleExport = () => {
    if (!exportData || exportData.length === 0) {
      alert('No hay datos para exportar.')
      return
    }
    exportToExcel(exportData, exportFilename, exportColumns)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
      {/* Buscador */}
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
        <input
          type="text"
          placeholder={`Buscar ${title}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141414] border border-neutral-800 text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-red-600 transition-colors"
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-3 w-full sm:w-auto">
        {/* Botón Exportar Excel */}
        <button
          onClick={handleExport}
          title="Exportar a Excel"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-green-500 hover:text-green-400 transition-colors font-bold text-sm whitespace-nowrap"
        >
          <Download size={18} />
          EXPORTAR
        </button>

        {/* Botón Nuevo */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          {showForm ? 'CANCELAR' : btnText}
        </button>
      </div>
    </div>
  )
}
