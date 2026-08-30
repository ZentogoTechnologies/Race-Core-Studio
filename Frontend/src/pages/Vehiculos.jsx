import { useEffect, useMemo, useState } from 'react'
import { Flag, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Users, Loader2 } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'
import Pagination from '../components/shared/Pagination'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { categoriasApi, pilotosApi, vehiculosApi } from '../api/registro'
import { useListado } from '../hooks/useListado'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useDisciplina } from '../context/DisciplinaContext'

const EMPTY_VEHICLE = {
  vehicle_id: '', number: '', display_number: '',
  brand: '', model: '', color: '',
  category_id: '', sub_category_id: '', pilot_ids: [],
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

export default function VehiculosModule() {
  const toast = useToast()
  const { puedeEscribir } = useAuth()
  const { disciplina } = useDisciplina()

  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  // La disciplina viaja siempre; la categoría solo si se eligió una.
  const filtros = useMemo(
    () => ({
      discipline: disciplina,
      ...(categoriaFiltro ? { category_id: categoriaFiltro } : {}),
    }),
    [disciplina, categoriaFiltro],
  )

  const lista = useListado(vehiculosApi, { ordenInicial: 'number', filtros })

  const [categorias,    setCategorias]    = useState([])
  const [pilotos,       setPilotos]       = useState([])
  const [isFormOpen,    setIsFormOpen]    = useState(false)
  const [currentEditId, setCurrentEditId] = useState(null)
  const [vehicleForm,   setVehicleForm]   = useState(EMPTY_VEHICLE)
  const [buscaPiloto,   setBuscaPiloto]   = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [porBorrar,     setPorBorrar]     = useState(null)

  // Catálogos completos para los selectores del formulario. Van sin
  // `limit` a propósito: aquí sí hace falta la lista entera.
  useEffect(() => {
    Promise.all([
      categoriasApi.listar({ sort_by: 'category_name', discipline: disciplina }),
      pilotosApi.listar({ sort_by: 'last_name' }),
    ])
      .then(([cats, pils]) => { setCategorias(cats.items); setPilotos(pils.items) })
      .catch(err => toast.error('No se pudieron cargar los catálogos', err.message))
  }, [disciplina])   // eslint-disable-line react-hooks/exhaustive-deps

  // Las subcategorías van embebidas en la categoría elegida.
  const subcategorias = useMemo(() => {
    const cat = categorias.find(c => String(c.category_id) === String(vehicleForm.category_id))
    return cat?.sub_categories || []
  }, [categorias, vehicleForm.category_id])

  const pilotosFiltrados = useMemo(() => {
    const t = buscaPiloto.trim().toLowerCase()
    if (!t) return pilotos
    return pilotos.filter(p => `${p.name} ${p.last_name}`.toLowerCase().includes(t))
  }, [pilotos, buscaPiloto])

  const openAddForm = () => {
    setVehicleForm(EMPTY_VEHICLE); setCurrentEditId(null)
    setBuscaPiloto(''); setIsFormOpen(true)
  }
  const closeForm = () => {
    setIsFormOpen(false); setCurrentEditId(null)
    setVehicleForm(EMPTY_VEHICLE); setBuscaPiloto('')
  }
  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  const openEditForm = (vehiculo) => {
    setVehicleForm({
      vehicle_id: vehiculo.vehicle_id,
      number: vehiculo.number,
      display_number: vehiculo.display_number || '',
      brand: vehiculo.brand || '',
      model: vehiculo.model || '',
      color: vehiculo.color || '',
      category_id: vehiculo.category_id,
      sub_category_id: vehiculo.sub_category_id ?? '',
      pilot_ids: (vehiculo.pilots || []).map(p => p.pilot_id),
    })
    setCurrentEditId(vehiculo.vehicle_id)
    setBuscaPiloto('')
    setIsFormOpen(true)
  }

  const alternarPiloto = (pilotId) => {
    setVehicleForm(f => {
      if (f.pilot_ids.includes(pilotId)) {
        return { ...f, pilot_ids: f.pilot_ids.filter(id => id !== pilotId) }
      }
      // El backend rechaza más de dos; se avisa aquí para no gastar un
      // viaje al servidor con un error que ya sabemos.
      if (f.pilot_ids.length >= 2) {
        toast.info('Máximo dos pilotos', 'Quita uno antes de agregar otro.')
        return f
      }
      return { ...f, pilot_ids: [...f.pilot_ids, pilotId] }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setGuardando(true)

    const cuerpo = {
      number: Number(vehicleForm.number),
      // Si se deja vacío, el backend lo rellena con el número. Importa
      // porque los ceros a la izquierda distinguen carros ('044' != '44').
      display_number: vehicleForm.display_number || null,
      brand: vehicleForm.brand || null,
      model: vehicleForm.model || null,
      color: vehicleForm.color || null,
      category_id: Number(vehicleForm.category_id),
      sub_category_id: vehicleForm.sub_category_id === '' ? null : Number(vehicleForm.sub_category_id),
      pilot_ids: vehicleForm.pilot_ids,
    }

    const etiqueta = `#${vehicleForm.number} ${vehicleForm.brand} ${vehicleForm.model}`.trim()

    try {
      if (currentEditId) {
        await vehiculosApi.actualizar(currentEditId, cuerpo)
        toast.exito('Vehículo actualizado', etiqueta)
      } else {
        await vehiculosApi.crear({ ...cuerpo, vehicle_id: Number(vehicleForm.vehicle_id) })
        toast.exito('Vehículo creado', etiqueta)
      }
      closeForm()
      lista.recargar()
    } catch (err) {
      toast.error(currentEditId ? 'No se pudo actualizar' : 'No se pudo crear', err.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmarBorrado = async () => {
    const vehiculo = porBorrar
    setPorBorrar(null)

    try {
      await vehiculosApi.eliminar(vehiculo.vehicle_id)
      toast.exito('Vehículo eliminado', `#${vehiculo.number} ${vehiculo.brand || ''}`.trim())
      lista.recargar()
    } catch (err) {
      toast.error('No se pudo eliminar', err.message)
    }
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="vehículos"
        searchText={lista.texto}
        onSearchChange={lista.setTexto}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO VEHÍCULO"
        puedeCrear={puedeEscribir}
        exportData={() => vehiculosApi.listar({ ...filtros, search: lista.texto || undefined, sort_by: lista.sortBy, sort_dir: lista.sortDir }).then(p => p.items)}
        onExportError={m => toast.error('No se pudo exportar', m)}
        exportFileName="vehiculos"
        exportColumnMap={{ vehicle_id: 'ID', number: 'Dorsal', brand: 'Marca', model: 'Modelo', category_name: 'Categoría' }}
      />

      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs uppercase tracking-wider text-neutral-500">Categoría</label>
        <select
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
          className="bg-[#141414] border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-red-600"
        >
          <option value="">Todas</option>
          {categorias.map(c => (
            <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
          ))}
        </select>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">ID</label>
              <input required type="number" min="1" value={vehicleForm.vehicle_id}
                disabled={Boolean(currentEditId)}
                onChange={e => setVehicleForm({ ...vehicleForm, vehicle_id: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white disabled:opacity-40 disabled:cursor-not-allowed"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Dorsal</label>
              <input required type="number" min="0" value={vehicleForm.number}
                onChange={e => setVehicleForm({ ...vehicleForm, number: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Dorsal en pantalla</label>
              <input type="text" value={vehicleForm.display_number} placeholder={vehicleForm.number || 'igual al dorsal'}
                onChange={e => setVehicleForm({ ...vehicleForm, display_number: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Color</label>
              <input type="text" value={vehicleForm.color}
                onChange={e => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Marca</label>
              <input required type="text" value={vehicleForm.brand}
                onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Modelo</label>
              <input type="text" value={vehicleForm.model}
                onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Categoría</label>
              <select required value={vehicleForm.category_id}
                onChange={e => setVehicleForm({ ...vehicleForm, category_id: e.target.value, sub_category_id: '' })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white">
                <option value="">Seleccionar...</option>
                {categorias.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Subcategoría</label>
              <select value={vehicleForm.sub_category_id}
                disabled={subcategorias.length === 0}
                onChange={e => setVehicleForm({ ...vehicleForm, sub_category_id: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white disabled:opacity-40">
                <option value="">{subcategorias.length ? 'Ninguna' : 'Sin subcategorías'}</option>
                {subcategorias.map(s => (
                  <option key={s.sub_category_id} value={s.sub_category_id}>{s.sub_category_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-neutral-400 text-xs mb-2 uppercase">
              Pilotos ({vehicleForm.pilot_ids.length}/2)
            </label>
            <input
              type="text" value={buscaPiloto} placeholder="Filtrar pilotos..."
              onChange={e => setBuscaPiloto(e.target.value)}
              className="w-full md:w-72 mb-3 bg-[#0a0a0a] border border-neutral-800 rounded p-2 text-sm focus:border-red-600 focus:outline-none text-white"
            />
            {/* Son más de cien pilotos: la caja se limita en alto y se
                desplaza, si no el formulario se vuelve una lista infinita. */}
            <div className="max-h-52 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-2 p-1">
              {pilotosFiltrados.map(piloto => {
                const asignado = vehicleForm.pilot_ids.includes(piloto.pilot_id)
                return (
                  <button
                    key={piloto.pilot_id} type="button"
                    onClick={() => alternarPiloto(piloto.pilot_id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border text-left truncate transition-colors ${
                      asignado
                        ? 'bg-red-600/15 border-red-600 text-red-400'
                        : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {piloto.name}
                  </button>
                )
              })}
              {pilotosFiltrados.length === 0 && (
                <p className="col-span-full text-sm text-neutral-600 py-3">Ningún piloto coincide.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button type="button" onClick={closeForm} className="px-6 py-2 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors font-bold">CANCELAR</button>
            <button type="submit" disabled={guardando}
              className="bg-white text-black font-bold py-2 px-8 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {guardando && <Loader2 size={16} className="animate-spin"/>}
              {currentEditId ? 'ACTUALIZAR' : 'GUARDAR'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold"><span className="flex items-center">Dorsal <SortIcon columnKey="number" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Vehículo <SortIcon columnKey="brand" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Categoría <SortIcon columnKey="category_id" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold">Pilotos</th>
              {puedeEscribir && <th className="p-4 font-bold text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {lista.cargando && (
              <tr><td colSpan={puedeEscribir ? 5 : 4} className="p-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600"/>
              </td></tr>
            )}

            {!lista.cargando && lista.error && (
              <tr><td colSpan={puedeEscribir ? 5 : 4} className="p-10 text-center text-red-500">{lista.error.message}</td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.length === 0 && (
              <tr><td colSpan={puedeEscribir ? 5 : 4} className="p-10 text-center text-neutral-500">
                {lista.texto ? `Sin resultados para "${lista.texto}".` : 'No hay vehículos registrados.'}
              </td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.map(vehiculo => (
              <tr key={vehiculo.vehicle_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="p-4">
                  <span className="inline-flex items-center justify-center min-w-[42px] h-9 px-2 rounded bg-neutral-800 text-white font-black font-mono">
                    {vehiculo.display_number || vehiculo.number}
                  </span>
                </td>
                <td className="p-4">
                  <p className="font-bold text-white">{vehiculo.brand || <span className="text-neutral-600">Sin marca</span>}</p>
                  <p className="text-xs text-neutral-500">{vehiculo.model || '—'}{vehiculo.color ? ` · ${vehiculo.color}` : ''}</p>
                </td>
                <td className="p-4 text-neutral-300 text-sm">
                  <span className="flex items-center gap-2"><Flag size={13} className="text-red-500"/>{vehiculo.category_name || `#${vehiculo.category_id}`}</span>
                  {vehiculo.sub_category_name && <p className="text-xs text-neutral-600 mt-0.5 pl-5">{vehiculo.sub_category_name}</p>}
                </td>
                <td className="p-4">
                  {vehiculo.pilots?.length
                    ? (
                      <div className="flex flex-col gap-0.5">
                        {vehiculo.pilots.map(p => (
                          <span key={p.pilot_id} className="text-sm text-neutral-300 flex items-center gap-2">
                            <Users size={12} className="text-neutral-600"/>{p.name}
                          </span>
                        ))}
                      </div>
                    )
                    : <span className="text-neutral-600">Sin piloto</span>}
                </td>
                {puedeEscribir && (
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => openEditForm(vehiculo)} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><Pencil size={15}/></button>
                    <button onClick={() => setPorBorrar(vehiculo)} className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={15}/></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {!lista.cargando && !lista.error && (
          <Pagination
            total={lista.total} skip={lista.skip} limit={lista.limit}
            onCambiarPagina={lista.setSkip} onCambiarTamano={lista.setLimit}
          />
        )}
      </div>

      <ConfirmDialog
        abierto={Boolean(porBorrar)}
        titulo="Eliminar vehículo"
        mensaje={porBorrar ? `Se va a eliminar el #${porBorrar.number} ${porBorrar.brand || ''}.` : ''}
        onCancelar={() => setPorBorrar(null)}
        onConfirmar={confirmarBorrado}
      />
    </div>
  )
}
