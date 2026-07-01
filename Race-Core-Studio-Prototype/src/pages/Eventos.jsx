import { useState } from 'react'
import ModuleHeader from '../components/shared/ModuleHeader'

// ==========================================
// 📁 src/pages/Eventos.jsx
// ==========================================
export default function EventosModule({ eventos, setEventos }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    fecha: '',
    ubicacion: '',
    estado: 'Próximo',
  })

  const filtered = eventos.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setEventos([...eventos, { ...formData, id: Date.now() }])
    setFormData({ nombre: '', fecha: '', ubicacion: '', estado: 'Próximo' })
    setShowForm(false)
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        title="eventos"
        search={search}
        setSearch={setSearch}
        showForm={showForm}
        setShowForm={setShowForm}
        btnText="NUEVO EVENTO"
        exportData={eventos}
        exportFilename="eventos"
        exportColumns={{ nombre: 'Evento', fecha: 'Fecha', ubicacion: 'Ubicación', estado: 'Estado' }}
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">
              Nombre del Evento
            </label>
            <input
              required
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Fecha</label>
            <input
              required
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Ubicación</label>
            <input
              required
              type="text"
              value={formData.ubicacion}
              onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
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
              <th className="p-4 font-bold">Evento</th>
              <th className="p-4 font-bold">Fecha &amp; Ubicación</th>
              <th className="p-4 font-bold text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => (
              <tr
                key={ev.id}
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
              >
                <td className="p-4 font-bold text-white text-lg">{ev.nombre}</td>
                <td className="p-4 text-neutral-300">
                  {ev.fecha} | {ev.ubicacion}
                </td>
                <td className="p-4 text-right">
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full">
                    {ev.estado}
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
