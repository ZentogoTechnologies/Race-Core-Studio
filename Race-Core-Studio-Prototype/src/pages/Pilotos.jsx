import { useState } from 'react'
import { Droplet } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'

// ==========================================
// 📁 src/pages/Pilotos.jsx
// ==========================================
export default function PilotosModule({ pilotos, setPilotos }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    sangre: '',
  })

  const filtered = pilotos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.apellido.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setPilotos([...pilotos, { ...formData, id: Date.now() }])
    setFormData({ nombre: '', apellido: '', sangre: '' })
    setShowForm(false)
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        title="pilotos"
        search={search}
        setSearch={setSearch}
        showForm={showForm}
        setShowForm={setShowForm}
        btnText="NUEVO PILOTO"
        exportData={pilotos}
        exportFilename="pilotos"
        exportColumns={{ nombre: 'Nombre', apellido: 'Apellido', sangre: 'Tipo de Sangre' }}
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
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Apellido</label>
            <input
              required
              type="text"
              value={formData.apellido}
              onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">
              Tipo de Sangre
            </label>
            <select
              required
              value={formData.sangre}
              onChange={(e) => setFormData({ ...formData, sangre: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            >
              <option value="">Seleccionar...</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
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
              <th className="p-4 font-bold">Piloto</th>
              <th className="p-4 font-bold">Sangre</th>
              <th className="p-4 font-bold text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
              >
                <td className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-red-500 font-bold">
                    {p.nombre.charAt(0)}
                    {p.apellido.charAt(0)}
                  </div>
                  <p className="font-bold text-white text-lg">
                    {p.nombre} <span className="uppercase">{p.apellido}</span>
                  </p>
                </td>
                <td className="p-4">
                  <span className="font-mono text-lg flex items-center gap-2">
                    <Droplet size={16} className="text-red-500" />
                    {p.sangre}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full">
                    ACTIVO
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
