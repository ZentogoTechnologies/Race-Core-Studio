import { useState, useMemo } from 'react'
import { Timer, Map, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'

// ─── Constantes ───────────────────────────────────────────────
const HEAT_CATEGORIES = ['TCR', 'GT Challenge', 'Street Legal', 'Prototype', 'Touring Car', 'Super Car']

const EMPTY_EVENT = {
  nombre:            '',
  fechaInicio:       '',
  fechaFin:          '',
  ubicacion:         '',
  estado:            'Próximo',
  modalidad:         '',   // 'Drag' | 'Circuito'
  tipoDrag:          '',   // 'Dragwar' | 'Competición'
  tipoCircuito:      '',   // 'Qualy' | 'Heat'
  categoriaHeat:     '',   // 'TCR' | 'GT Challenge' | 'Street Legal' | etc.
}

const ESTADO_BADGE_STYLES = {
  'Próximo':    'bg-blue-500/10 text-blue-400',
  'En Curso':   'bg-yellow-500/10 text-yellow-400',
  'Finalizado': 'bg-neutral-500/10 text-neutral-400',
  'Cancelado':  'bg-red-500/10 text-red-400',
}

// ─── Sub-componente: ícono de orden en cabecera ───────────────
function SortIcon({ columnKey, sortField, sortDirection, onSort }) {
  const isActive = sortField === columnKey
  return (
    <button onClick={() => onSort(columnKey)} className="inline-flex items-center hover:text-white transition-colors ml-1">
      {isActive
        ? sortDirection === 'asc' ? <ChevronUp size={13} className="text-red-400" /> : <ChevronDown size={13} className="text-red-400" />
        : <ChevronsUpDown size={13} className="text-neutral-600" />}
    </button>
  )
}

// ─── Sub-componente: botón de selección tipo toggle ───────────
function ToggleButton({ label, icon, isSelected, colorScheme = 'red', onClick }) {
  const selectedStyles = colorScheme === 'blue'
    ? 'bg-blue-600/20 border-blue-600 text-blue-400'
    : 'bg-red-600/20 border-red-600 text-red-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-4 rounded-lg border font-bold text-sm transition-all flex items-center justify-center gap-2 ${
        isSelected ? selectedStyles : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:border-neutral-600'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────
export default function EventosModule({ eventos, setEventos }) {
  const [searchText,     setSearchText]     = useState('')
  const [isFormOpen,     setIsFormOpen]     = useState(false)
  const [currentEditId,  setCurrentEditId]  = useState(null)
  const [eventForm,      setEventForm]      = useState(EMPTY_EVENT)
  const [sortField,      setSortField]      = useState(null)
  const [sortDirection,  setSortDirection]  = useState('asc')

  // ── Helpers de formulario ──
  const updateField = (field, value) => {
    setEventForm(prev => {
      const updated = { ...prev, [field]: value }
      // Limpiar sub-selecciones al cambiar modalidad
      if (field === 'modalidad') {
        updated.tipoDrag      = ''
        updated.tipoCircuito  = ''
        updated.categoriaHeat = ''
      }
      // Limpiar categoría heat si cambia tipo circuito
      if (field === 'tipoCircuito') {
        updated.categoriaHeat = ''
      }
      return updated
    })
  }

  const openAddForm = () => {
    setEventForm(EMPTY_EVENT)
    setCurrentEditId(null)
    setIsFormOpen(true)
  }

  const openEditForm = (evento) => {
    setEventForm({ ...evento })
    setCurrentEditId(evento.id)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setCurrentEditId(null)
    setEventForm(EMPTY_EVENT)
  }

  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  // ── Validación antes de guardar ──
  const isFormValid = () => {
    if (!eventForm.modalidad) return false
    if (eventForm.modalidad === 'Drag' && !eventForm.tipoDrag) return false
    if (eventForm.modalidad === 'Circuito' && !eventForm.tipoCircuito) return false
    if (eventForm.tipoCircuito === 'Heat' && !eventForm.categoriaHeat) return false
    return true
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!isFormValid()) return

    if (currentEditId) {
      setEventos(eventos.map(ev => ev.id === currentEditId ? { ...eventForm, id: currentEditId } : ev))
    } else {
      setEventos([...eventos, { ...eventForm, id: Date.now() }])
    }
    closeForm()
  }

  // ── Sorting ──
  const handleSort = (field) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  // ── Filas filtradas y ordenadas ──
  const filteredAndSortedEvents = useMemo(() => {
    let result = eventos.filter(ev =>
      ev.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      (ev.ubicacion || '').toLowerCase().includes(searchText.toLowerCase())
    )
    if (sortField) {
      result = [...result].sort((a, b) => {
        const valueA = (a[sortField] || '').toString().toLowerCase()
        const valueB = (b[sortField] || '').toString().toLowerCase()
        return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA)
      })
    }
    return result
  }, [eventos, searchText, sortField, sortDirection])

  // ── Helper: texto de modalidad completo ──
  const getModalidadLabel = (evento) => {
    if (!evento.modalidad) return null
    if (evento.modalidad === 'Drag') return evento.tipoDrag || 'Drag'
    if (evento.tipoCircuito === 'Heat') return `Heat — ${evento.categoriaHeat}`
    return evento.tipoCircuito || 'Circuito'
  }

  // ── Datos para exportar ──
  const exportData = eventos.map(ev => ({
    nombre:        ev.nombre,
    fechaInicio:   ev.fechaInicio,
    fechaFin:      ev.fechaFin,
    ubicacion:     ev.ubicacion,
    modalidad:     ev.modalidad,
    detalle:       getModalidadLabel(ev),
    estado:        ev.estado,
  }))

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="eventos"
        searchText={searchText}
        onSearchChange={setSearchText}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO EVENTO"
        exportData={exportData}
        exportFileName="eventos"
        exportColumnMap={{
          nombre: 'Evento', fechaInicio: 'Fecha Inicio', fechaFin: 'Fecha Fin',
          ubicacion: 'Ubicación', modalidad: 'Modalidad', detalle: 'Detalle', estado: 'Estado',
        }}
      />

      {/* ── Formulario ── */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Nombre */}
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre del Evento</label>
              <input required type="text" value={eventForm.nombre}
                onChange={e => updateField('nombre', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white" />
            </div>

            {/* Fecha Inicio */}
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Fecha de Inicio</label>
              <input required type="date" value={eventForm.fechaInicio}
                onChange={e => updateField('fechaInicio', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white" />
            </div>

            {/* Fecha Fin */}
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Fecha de Finalización</label>
              <input type="date" value={eventForm.fechaFin}
                min={eventForm.fechaInicio || undefined}
                onChange={e => updateField('fechaFin', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white" />
            </div>

            {/* Ubicación */}
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Ubicación</label>
              <input required type="text" value={eventForm.ubicacion}
                onChange={e => updateField('ubicacion', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white" />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Estado</label>
              <select value={eventForm.estado} onChange={e => updateField('estado', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white">
                <option>Próximo</option>
                <option>En Curso</option>
                <option>Finalizado</option>
                <option>Cancelado</option>
              </select>
            </div>
          </div>

          {/* ── Selector de modalidad ── */}
          <div className="mt-5 border-t border-neutral-800 pt-5">
            <label className="block text-neutral-400 text-xs mb-3 uppercase">Modalidad del Evento</label>
            <div className="flex gap-3 max-w-sm">
              <ToggleButton label="Drag" icon={<Timer size={15}/>}
                isSelected={eventForm.modalidad === 'Drag'} colorScheme="red"
                onClick={() => updateField('modalidad', 'Drag')} />
              <ToggleButton label="Circuito" icon={<Map size={15}/>}
                isSelected={eventForm.modalidad === 'Circuito'} colorScheme="blue"
                onClick={() => updateField('modalidad', 'Circuito')} />
            </div>

            {/* Sub-opciones Drag */}
            {eventForm.modalidad === 'Drag' && (
              <div className="mt-4">
                <label className="block text-neutral-400 text-xs mb-3 uppercase">Tipo de Evento Drag</label>
                <div className="flex gap-3 max-w-sm">
                  <ToggleButton label="Dragwar"    isSelected={eventForm.tipoDrag === 'Dragwar'}    onClick={() => updateField('tipoDrag', 'Dragwar')} />
                  <ToggleButton label="Competición" isSelected={eventForm.tipoDrag === 'Competición'} onClick={() => updateField('tipoDrag', 'Competición')} />
                </div>
              </div>
            )}

            {/* Sub-opciones Circuito */}
            {eventForm.modalidad === 'Circuito' && (
              <div className="mt-4">
                <label className="block text-neutral-400 text-xs mb-3 uppercase">Tipo de Evento Circuito</label>
                <div className="flex gap-3 max-w-xl">
                  <ToggleButton label="Práctica" colorScheme="blue"
                    isSelected={eventForm.tipoCircuito === 'Práctica'}
                    onClick={() => updateField('tipoCircuito', 'Práctica')} />
                  <ToggleButton label="Qualy" colorScheme="blue"
                    isSelected={eventForm.tipoCircuito === 'Qualy'}
                    onClick={() => updateField('tipoCircuito', 'Qualy')} />
                  <ToggleButton label="Heat" colorScheme="blue"
                    isSelected={eventForm.tipoCircuito === 'Heat'}
                    onClick={() => updateField('tipoCircuito', 'Heat')} />
                </div>

                {/* Sub-opciones Heat */}
                {eventForm.tipoCircuito === 'Heat' && (
                  <div className="mt-4 max-w-sm">
                    <label className="block text-neutral-400 text-xs mb-3 uppercase">Categoría del Heat</label>
                    <div className="grid grid-cols-2 gap-2">
                      {HEAT_CATEGORIES.map(cat => (
                        <ToggleButton key={cat} label={cat} colorScheme="blue"
                          isSelected={eventForm.categoriaHeat === cat}
                          onClick={() => updateField('categoriaHeat', cat)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mensajes de validación */}
          <div className="mt-4 space-y-1">
            {!eventForm.modalidad && <p className="text-xs text-red-400">* Selecciona una modalidad.</p>}
            {eventForm.modalidad === 'Drag' && !eventForm.tipoDrag && <p className="text-xs text-red-400">* Selecciona el tipo de evento Drag.</p>}
            {eventForm.modalidad === 'Circuito' && !eventForm.tipoCircuito && <p className="text-xs text-red-400">* Selecciona Qualy o Heat.</p>}
            {eventForm.tipoCircuito === 'Heat' && !eventForm.categoriaHeat && <p className="text-xs text-red-400">* Selecciona la categoría del Heat.</p>}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeForm}
              className="px-6 py-2 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors font-bold">
              CANCELAR
            </button>
            <button type="submit" disabled={!isFormValid()}
              className="bg-white text-black font-bold py-2 px-8 rounded hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {currentEditId ? 'ACTUALIZAR' : 'GUARDAR'}
            </button>
          </div>
        </form>
      )}

      {/* ── Tabla ── */}
      <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">
                <span className="flex items-center">Evento <SortIcon columnKey="nombre" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span>
              </th>
              <th className="p-4 font-bold">
                <span className="flex items-center">Fechas <SortIcon columnKey="fechaInicio" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span>
              </th>
              <th className="p-4 font-bold">
                <span className="flex items-center">Modalidad <SortIcon columnKey="modalidad" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span>
              </th>
              <th className="p-4 font-bold text-right">
                <span className="flex items-center justify-end">Estado <SortIcon columnKey="estado" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}/></span>
              </th>
              <th className="p-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEvents.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-neutral-500">No hay eventos registrados.</td></tr>
            )}
            {filteredAndSortedEvents.map(evento => (
              <tr key={evento.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="p-4">
                  <p className="font-bold text-white">{evento.nombre}</p>
                  <p className="text-neutral-500 text-xs">{evento.ubicacion}</p>
                </td>
                <td className="p-4 text-sm text-neutral-300">
                  <p>{evento.fechaInicio || '—'}</p>
                  {evento.fechaFin && <p className="text-neutral-500 text-xs">hasta {evento.fechaFin}</p>}
                </td>
                <td className="p-4">
                  {evento.modalidad && (
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit ${
                        evento.modalidad === 'Drag' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {evento.modalidad === 'Drag' ? <Timer size={11}/> : <Map size={11}/>}
                        {evento.modalidad}
                      </span>
                      {getModalidadLabel(evento) && (
                        <span className="text-xs text-neutral-500 pl-1">{getModalidadLabel(evento)}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-4 text-right">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${ESTADO_BADGE_STYLES[evento.estado] || 'bg-neutral-500/10 text-neutral-400'}`}>
                    {evento.estado}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => openEditForm(evento)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors">
                    <Pencil size={15}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
