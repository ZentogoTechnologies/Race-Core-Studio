import { useState } from 'react'
import ModuleHeader from '../components/shared/ModuleHeader'

// ==========================================
// 📁 src/pages/Categorias.jsx
// ==========================================
export default function CategoriasModule({ categorias, setCategorias }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    restricciones: '',
    peso: '',
  })

  const filtered = categorias.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setCategorias([...categorias, { ...formData, id: Date.now() }])
    setFormData({ nombre: '', restricciones: '', peso: '' })
    setShowForm(false)
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        title="categorías"
        search={search}
        setSearch={setSearch}
        showForm={showForm}
        setShowForm={setShowForm}
        btnText="NUEVA CATEGORÍA"
        exportData={categorias}
        exportFilename="categorias"
        exportColumns={{ nombre: 'Categoría', restricciones: 'Reglas / Motor', peso: 'Peso Mínimo' }}
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre</label>
            <input
              required
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">
              Reglas / Motor
            </label>
            <input
              required
              type="text"
              value={formData.restricciones}
              onChange={(e) =>
                setFormData({ ...formData, restricciones: e.target.value })
              }
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">
              Peso Mínimo
            </label>
            <input
              required
              type="text"
              value={formData.peso}
              onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full bg-white text-black font-bold py-2 px-4 rounded hover:bg-neutral-200 transition-colors"
            >
              GUARDAR
            </button>
          </div>
        </form>
      )}

      <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Categoría</th>
              <th className="p-4 font-bold">Especificaciones</th>
              <th className="p-4 font-bold text-right">Peso Req.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
              >
                <td className="p-4 font-bold text-white text-lg italic">{c.nombre}</td>
                <td className="p-4 text-neutral-300 text-sm">{c.restricciones}</td>
                <td className="p-4 text-right text-red-400 font-mono">{c.peso}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
