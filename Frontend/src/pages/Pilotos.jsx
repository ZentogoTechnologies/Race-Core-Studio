import { useState, useMemo } from 'react'
import { Droplet, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EMPTY_PILOT = { nombre: '', apellido: '', tipoSangre: '' }

function SortIcon({ columnKey, sortField, sortDirection, onSort }) {
  const isActive = sortField === columnKey
  return (
    <button onClick={() => onSort(columnKey)} className="inline-flex items-center hover:text-white transition-colors ml-1">
      {isActive
        ? sortDirection === 'asc' ? <ChevronUp size={13} className="text-red-400"/> : <ChevronDown size={13} className="text-red-400"/>
        : <ChevronsUpDown size={13} className="text-neutral-600"/>}
    </button>
  )
}

export default function PilotosModule({ pilotos, setPilotos }) {
  const [searchText,    setSearchText]    = useState('')
  const [isFormOpen,    setIsFormOpen]    = useState(false)
  const [currentEditId, setCurrentEditId] = useState(null)
  const [pilotForm,     setPilotForm]     = useState(EMPTY_PILOT)
  const [sortField,     setSortField]     = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const openAddForm  = () => { setPilotForm(EMPTY_PILOT); setCurrentEditId(null); setIsFormOpen(true) }
  const openEditForm = (piloto) => { setPilotForm({ ...piloto }); setCurrentEditId(piloto.id); setIsFormOpen(true) }
  const closeForm    = () => { setIsFormOpen(false); setCurrentEditId(null); setPilotForm(EMPTY_PILOT) }
  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  const handleSave = (e) => {
    e.preventDefault()
    if (currentEditId) {
      setPilotos(pilotos.map(p => p.id === currentEditId ? { ...pilotForm, id: currentEditId } : p))
    } else {
      setPilotos([...pilotos, { ...pilotForm, id: Date.now() }])
    }
    closeForm()
  }

  const filteredAndSortedPilots = useMemo(() => {
    let result = pilotos.filter(p =>
      p.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      p.apellido.toLowerCase().includes(searchText.toLowerCase())
    )
    if (sortField) {
      result = [...result].sort((a, b) => {
        const valueA = (a[sortField] || '').toString().toLowerCase()
        const valueB = (b[sortField] || '').toString().toLowerCase()
        return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA)
      })
    }
    return result
  }, [pilotos, searchText, sortField, sortDirection])

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="pilotos"
        searchText={searchText}
        onSearchChange={setSearchText}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO PILOTO"
        exportData={pilotos}
        exportFileName="pilotos"
        exportColumnMap={{ nombre: 'Nombre', apellido: 'Apellido', tipoSangre: 'Tipo de Sangre' }}
      />

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre</label>
            <input required type="text" value={pilotForm.nombre}
              onChange={e => setPilotForm({...pilotForm, nombre: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Apellido</label>
            <input required type="text" value={pilotForm.apellido}
              onChange={e => setPilotForm({...pilotForm, apellido: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Tipo de Sangre</label>
            <select required value={pilotForm.tipoSangre}
              onChange={e => setPilotForm({...pilotForm, tipoSangre: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white">
              <option value="">Seleccionar...</option>
              {BLOOD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="col-span-full flex justify-end gap-3 mt-2">
            <button type="button" onClick={closeForm} className="px-6 py-2 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors font-bold">CANCELAR</button>
            <button type="submit" className="bg-white text-black font-bold py-2 px-8 rounded hover:bg-neutral-200 transition-colors">{currentEditId ? 'ACTUALIZAR' : 'GUARDAR'}</button>
          </div>
        </form>
      )}

      <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold"><span className="flex items-center">Piloto <SortIcon columnKey="apellido" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Sangre <SortIcon columnKey="tipoSangre" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span></th>
              <th className="p-4 font-bold text-right">Estado</th>
              <th className="p-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPilots.length === 0 && (
              <tr><td colSpan={4} className="p-10 text-center text-neutral-500">No hay pilotos registrados.</td></tr>
            )}
            {filteredAndSortedPilots.map(piloto => (
              <tr key={piloto.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-red-500 font-bold flex-shrink-0">
                    {piloto.nombre.charAt(0)}{piloto.apellido.charAt(0)}
                  </div>
                  <p className="font-bold text-white">{piloto.nombre} <span className="uppercase">{piloto.apellido}</span></p>
                </td>
                <td className="p-4">
                  <span className="font-mono flex items-center gap-2"><Droplet size={14} className="text-red-500"/>{piloto.tipoSangre}</span>
                </td>
                <td className="p-4 text-right"><span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full">ACTIVO</span></td>
                <td className="p-4 text-right">
                  <button onClick={() => openEditForm(piloto)} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><Pencil size={15}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
