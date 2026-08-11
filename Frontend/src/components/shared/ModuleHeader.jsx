import { Search, Plus, X, Download } from 'lucide-react'
import { exportToJSON } from '../../utils/exportJSON'

export default function ModuleHeader({
  entityName,           // texto para el placeholder del buscador
  searchText,
  onSearchChange,
  isFormOpen,
  onFormToggle,
  addButtonLabel,
  exportData,
  exportFileName,
  exportColumnMap,
}) {
  const handleExport = () => {
    if (!exportData || exportData.length === 0) {
      alert('No hay datos para exportar.')
      return
    }
    exportToJSON(exportData, exportFileName, exportColumnMap)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
        <input
          type="text"
          placeholder={`Buscar ${entityName}...`}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#141414] border border-neutral-800 text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-red-600 transition-colors"
        />
      </div>

      <div className="flex gap-3 w-full sm:w-auto">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-green-500 hover:text-green-400 transition-colors font-bold text-sm whitespace-nowrap"
        >
          <Download size={18} />
          EXPORTAR
        </button>
        <button
          onClick={onFormToggle}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          {isFormOpen ? <X size={20} /> : <Plus size={20} />}
          {isFormOpen ? 'CANCELAR' : addButtonLabel}
        </button>
      </div>
    </div>
  )
}
