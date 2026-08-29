import { useState } from 'react'
import { Search, Plus, X, Download, Loader2 } from 'lucide-react'
import { exportToJSON } from '../../utils/exportJSON'

export default function ModuleHeader({
  entityName,           // texto para el placeholder del buscador
  searchText,
  onSearchChange,
  isFormOpen,
  onFormToggle,
  addButtonLabel,
  // El rol estándar no crea registros. Esconder el botón es cortesía: el
  // backend responde 403 igual si alguien llama la ruta a mano.
  puedeCrear = true,
  // Array, o función que devuelve una promesa con las filas. Los listados
  // paginados pasan una función: si pasaran su página, el archivo saldría
  // con los 25 registros a la vista en vez de con todos los que hay.
  exportData,
  exportFileName,
  exportColumnMap,
  onExportError,
}) {
  const [exportando, setExportando] = useState(false)

  const handleExport = async () => {
    setExportando(true)
    try {
      const filas = typeof exportData === 'function' ? await exportData() : exportData

      if (!filas || filas.length === 0) {
        onExportError?.('No hay datos para exportar')
        return
      }

      exportToJSON(filas, exportFileName, exportColumnMap)
    } catch (err) {
      onExportError?.(err.message)
    } finally {
      setExportando(false)
    }
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
          disabled={exportando}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-green-500 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm whitespace-nowrap"
        >
          {exportando ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          EXPORTAR
        </button>
        {puedeCrear && (
          <button
            onClick={onFormToggle}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            {isFormOpen ? <X size={20} /> : <Plus size={20} />}
            {isFormOpen ? 'CANCELAR' : addButtonLabel}
          </button>
        )}
      </div>
    </div>
  )
}
