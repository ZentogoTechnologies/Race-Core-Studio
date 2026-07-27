import { useState } from 'react'
import { Flag } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'

// ==========================================
// 📁 src/pages/Vehiculos.jsx
// ==========================================
export default function VehiculosModule({ vehiculos, setVehiculos }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    equipo: '',
  })

  const filtered = vehiculos.filter(
    (v) =>
      v.marca.toLowerCase().includes(search.toLowerCase()) ||
      v.equipo.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setVehiculos([...vehiculos, { ...formData, id: Date.now() }])
    setFormData({ marca: '', modelo: '', equipo: '' })
    setShowForm(false)
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        title="vehículos"
        search={search}
        setSearch={setSearch}
        showForm={showForm}
        setShowForm={setShowForm}
        btnText="NUEVO VEHÍCULO"
        exportData={vehiculos}
        exportFilename="vehiculos"
        exportColumns={{ marca: 'Marca', modelo: 'Modelo / Versión', equipo: 'Equipo' }}
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Marca</label>
            <input
              required
              type="text"
              value={formData.marca}
              onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">
              Modelo / Versión
            </label>
            <input
              required
              type="text"
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">
              Equipo Perteneciente
            </label>
            <input
              required
              type="text"
              value={formData.equipo}
              onChange={(e) => setFormData({ ...formData, equipo: e.target.value })}
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
              <th className="p-4 font-bold">Vehículo</th>
              <th className="p-4 font-bold">Equipo</th>
              <th className="p-4 font-bold text-right">Inscripción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr
                key={v.id}
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
              >
                <td className="p-4">
                  <p className="font-black text-white text-xl italic">{v.marca}</p>
                  <p className="text-red-500 font-bold text-sm">{v.modelo}</p>
                </td>
                <td className="p-4 text-neutral-300">
                  <span className="flex items-center gap-2 mt-2">
                    <Flag size={16} />
                    {v.equipo}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full">
                    VERIFICADO
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
