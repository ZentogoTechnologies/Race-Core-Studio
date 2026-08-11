import { useState, useMemo } from 'react'
import { Flag, Pencil, ChevronUp, ChevronDown, ChevronsUpDown, Users } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'

const EMPTY_VEHICLE = {
  marca:        '',
  modelo:       '',
  equipo:       '',
  categoriaId:  '',
  pilotoIds:    [],   // Array de IDs (máx. 2)
}

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

export default function VehiculosModule({ vehiculos, setVehiculos, categorias, pilotos }) {
  const [searchText,       setSearchText]       = useState('')
  const [isFormOpen,       setIsFormOpen]        = useState(false)
  const [currentEditId,    setCurrentEditId]     = useState(null)
  const [vehicleForm,      setVehicleForm]       = useState(EMPTY_VEHICLE)
  const [sortField,        setSortField]         = useState(null)
  const [sortDirection,    setSortDirection]     = useState('asc')
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null)

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const openAddForm  = () => { setVehicleForm(EMPTY_VEHICLE); setCurrentEditId(null); setIsFormOpen(true) }
  const openEditForm = (vehiculo) => { setVehicleForm({ ...vehiculo, pilotoIds: vehiculo.pilotoIds || [] }); setCurrentEditId(vehiculo.id); setIsFormOpen(true) }
  const closeForm    = () => { setIsFormOpen(false); setCurrentEditId(null); setVehicleForm(EMPTY_VEHICLE) }
  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  const togglePilotAssignment = (pilotoId) => {
    setVehicleForm(prev => {
      const currentIds = prev.pilotoIds || []
      if (currentIds.includes(pilotoId)) {
        return { ...prev, pilotoIds: currentIds.filter(id => id !== pilotoId) }
      }
      if (currentIds.length >= 2) return prev // máx. 2 pilotos por vehículo
      return { ...prev, pilotoIds: [...currentIds, pilotoId] }
    })
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (currentEditId) {
      setVehiculos(vehiculos.map(v => v.id === currentEditId ? { ...vehicleForm, id: currentEditId } : v))
    } else {
      setVehiculos([...vehiculos, { ...vehicleForm, id: Date.now() }])
    }
    closeForm()
  }

  const getCategoryName = (categoriaId) =>
    categorias.find(c => c.id === categoriaId)?.nombre || '—'

  const getPilotsForVehicle = (pilotoIds) =>
    pilotos.filter(p => (pilotoIds || []).includes(p.id))

  const filteredAndSortedVehicles = useMemo(() => {
    let result = vehiculos.filter(v =>
      v.marca.toLowerCase().includes(searchText.toLowerCase()) ||
      v.modelo.toLowerCase().includes(searchText.toLowerCase()) ||
      v.equipo.toLowerCase().includes(searchText.toLowerCase())
    )
    if (sortField) {
      result = [...result].sort((a, b) => {
        const valueA = (a[sortField] || '').toString().toLowerCase()
        const valueB = (b[sortField] || '').toString().toLowerCase()
        return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA)
      })
    }
    return result
  }, [vehiculos, searchText, sortField, sortDirection])

  // Vehículo actualmente en hover para el snackbar
  const hoveredVehicle    = vehiculos.find(v => v.id === hoveredVehicleId)
  const hoveredVehiclePilots = hoveredVehicle ? getPilotsForVehicle(hoveredVehicle.pilotoIds) : []

  // Datos para exportación con nombres resueltos
  const exportData = vehiculos.map(v => ({
    marca:     v.marca,
    modelo:    v.modelo,
    equipo:    v.equipo,
    categoria: getCategoryName(v.categoriaId),
    pilotos:   getPilotsForVehicle(v.pilotoIds).map(p => `${p.nombre} ${p.apellido}`).join(' / '),
  }))

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="vehículos"
        searchText={searchText}
        onSearchChange={setSearchText}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO VEHÍCULO"
        exportData={exportData}
        exportFileName="vehiculos"
        exportColumnMap={{ marca: 'Marca', modelo: 'Modelo / Versión', equipo: 'Equipo', categoria: 'Categoría', pilotos: 'Pilotos' }}
      />

      {/* ── Formulario ── */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Marca</label>
              <input required type="text" value={vehicleForm.marca}
                onChange={e => setVehicleForm({...vehicleForm, marca: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Modelo / Versión</label>
              <input required type="text" value={vehicleForm.modelo}
                onChange={e => setVehicleForm({...vehicleForm, modelo: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Equipo</label>
              <input required type="text" value={vehicleForm.equipo}
                onChange={e => setVehicleForm({...vehicleForm, equipo: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Categoría</label>
              {categorias.length === 0 ? (
                <p className="text-xs text-yellow-500 py-2 px-1">No hay categorías creadas aún.</p>
              ) : (
                <select required value={vehicleForm.categoriaId}
                  onChange={e => setVehicleForm({...vehicleForm, categoriaId: Number(e.target.value)})}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white">
                  <option value="">Seleccionar categoría...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Asignación de pilotos */}
          <div className="mt-5 border-t border-neutral-800 pt-5">
            <label className="block text-neutral-400 text-xs mb-3 uppercase">
              Pilotos Asignados <span className="text-neutral-600 normal-case font-normal">(máx. 2 por vehículo)</span>
            </label>
            {pilotos.length === 0 ? (
              <p className="text-xs text-yellow-500">No hay pilotos registrados aún.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {pilotos.map(piloto => {
                  const isAssigned = (vehicleForm.pilotoIds || []).includes(piloto.id)
                  const isDisabled = !isAssigned && (vehicleForm.pilotoIds || []).length >= 2
                  return (
                    <label key={piloto.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isAssigned  ? 'border-red-600 bg-red-600/10'
                        : isDisabled ? 'border-neutral-800 opacity-40 cursor-not-allowed'
                        : 'border-neutral-800 hover:border-neutral-600 cursor-pointer'
                      }`}>
                      <input type="checkbox" checked={isAssigned} disabled={isDisabled}
                        onChange={() => togglePilotAssignment(piloto.id)}
                        className="accent-red-600 flex-shrink-0"/>
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-red-500 text-xs font-bold flex-shrink-0">
                        {piloto.nombre.charAt(0)}{piloto.apellido.charAt(0)}
                      </div>
                      <span className="text-white text-sm font-semibold truncate">
                        {piloto.nombre} <span className="uppercase">{piloto.apellido}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeForm}
              className="px-6 py-2 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors font-bold">CANCELAR</button>
            <button type="submit"
              className="bg-white text-black font-bold py-2 px-8 rounded hover:bg-neutral-200 transition-colors">{currentEditId ? 'ACTUALIZAR' : 'GUARDAR'}</button>
          </div>
        </form>
      )}

      {/* ── Tabla ── */}
      <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold"><span className="flex items-center">Vehículo <SortIcon columnKey="marca" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Equipo <SortIcon columnKey="equipo" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Categoría <SortIcon columnKey="categoriaId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span></th>
              <th className="p-4 font-bold text-center">Pilotos</th>
              <th className="p-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedVehicles.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-neutral-500">No hay vehículos registrados.</td></tr>
            )}
            {filteredAndSortedVehicles.map(vehiculo => {
              const assignedPilots = getPilotsForVehicle(vehiculo.pilotoIds)
              return (
                <tr key={vehiculo.id}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
                  onMouseEnter={() => setHoveredVehicleId(vehiculo.id)}
                  onMouseLeave={() => setHoveredVehicleId(null)}
                >
                  <td className="p-4">
                    <p className="font-black text-white text-lg italic">{vehiculo.marca}</p>
                    <p className="text-red-500 font-bold text-sm">{vehiculo.modelo}</p>
                  </td>
                  <td className="p-4 text-neutral-300">
                    <span className="flex items-center gap-2"><Flag size={14}/> {vehiculo.equipo}</span>
                  </td>
                  <td className="p-4 text-neutral-300 text-sm">{getCategoryName(vehiculo.categoriaId)}</td>
                  <td className="p-4 text-center">
                    {assignedPilots.length === 0 ? (
                      <span className="text-neutral-600 text-xs">Sin asignar</span>
                    ) : (
                      <div className="flex justify-center -space-x-2">
                        {assignedPilots.map(piloto => (
                          <div key={piloto.id}
                            title={`${piloto.nombre} ${piloto.apellido}`}
                            className="w-9 h-9 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center text-red-400 text-xs font-bold">
                            {piloto.nombre.charAt(0)}{piloto.apellido.charAt(0)}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEditForm(vehiculo)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors">
                      <Pencil size={15}/>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Snackbar de pilotos (aparece al hacer hover en una fila) ── */}
      {hoveredVehicle && hoveredVehiclePilots.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl px-6 py-4 shadow-2xl shadow-black/60 flex items-center gap-5">
            <div className="bg-red-600/10 p-2.5 rounded-xl">
              <Users size={20} className="text-red-500"/>
            </div>
            <div>
              <p className="text-neutral-400 text-xs uppercase tracking-wider mb-1.5">
                {hoveredVehicle.equipo} —{' '}
                <span className="text-white">{hoveredVehicle.marca} {hoveredVehicle.modelo}</span>
              </p>
              <div className="flex items-center gap-4">
                {hoveredVehiclePilots.map((piloto, index) => (
                  <div key={piloto.id} className="flex items-center gap-2">
                    {index > 0 && <span className="text-neutral-600 font-light">/</span>}
                    <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-red-400 text-xs font-bold">
                      {piloto.nombre.charAt(0)}{piloto.apellido.charAt(0)}
                    </div>
                    <span className="text-white font-bold text-sm">
                      {piloto.nombre} <span className="uppercase">{piloto.apellido}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
