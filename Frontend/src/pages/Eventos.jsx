import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Loader2,
  CalendarDays, Users, Car, ListOrdered,
} from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'
import Pagination from '../components/shared/Pagination'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import SesionesEvento from '../components/events/SesionesEvento'
import { categoriasApi, eventosApi, vehiculosApi } from '../api/registro'
import { useListado } from '../hooks/useListado'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useDisciplina } from '../context/DisciplinaContext'

const EMPTY_EVENT = {
  name: '', location: '', start_date: '', end_date: '',
  category_ids: [], inscritos: [],
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

// Los días se cuentan con ambos extremos incluidos: un evento de sábado a
// domingo son dos días, no uno. El servidor calcula lo mismo; esto es solo
// para que el formulario lo muestre antes de guardar.
function contarDias(inicio, fin) {
  if (!inicio || !fin) return 0
  const a = new Date(`${inicio}T00:00:00`)
  const b = new Date(`${fin}T00:00:00`)
  if (b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

export default function EventosModule() {
  const toast = useToast()
  const { puedeEscribir } = useAuth()
  const { disciplina } = useDisciplina()

  const filtros = useMemo(() => ({ discipline: disciplina }), [disciplina])
  const lista = useListado(eventosApi, { ordenInicial: 'start_date', filtros })

  const [categorias,   setCategorias]   = useState([])
  const [vehiculos,    setVehiculos]    = useState([])
  const [isFormOpen,   setIsFormOpen]   = useState(false)
  const [currentEditId, setCurrentEditId] = useState(null)
  const [eventForm,    setEventForm]    = useState(EMPTY_EVENT)
  const [guardando,    setGuardando]    = useState(false)
  const [porBorrar,    setPorBorrar]    = useState(null)
  const [expandido,    setExpandido]    = useState(null)   // evento con el programa abierto

  // Catálogos de la disciplina activa. Los vehículos traen sus pilotos ya
  // resueltos, que es lo que hace falta para elegir quién corre.
  useEffect(() => {
    Promise.all([
      categoriasApi.listar({ sort_by: 'category_name', discipline: disciplina }),
      vehiculosApi.listar({ sort_by: 'number', discipline: disciplina }),
    ])
      .then(([c, v]) => { setCategorias(c.items); setVehiculos(v.items) })
      .catch(err => toast.error('No se pudieron cargar los catálogos', err.message))
  }, [disciplina])   // eslint-disable-line react-hooks/exhaustive-deps

  const totalDias = contarDias(eventForm.start_date, eventForm.end_date)

  // Solo se pueden inscribir carros de las categorías elegidas: el backend
  // lo rechaza igual, y ofrecer el resto solo lleva a un error evitable.
  const vehiculosElegibles = useMemo(
    () => vehiculos.filter(v => eventForm.category_ids.includes(v.category_id)),
    [vehiculos, eventForm.category_ids],
  )

  const inscrito = (vehicleId) =>
    eventForm.inscritos.find(i => i.vehicle_id === vehicleId)

  const openAddForm = () => { setEventForm(EMPTY_EVENT); setCurrentEditId(null); setIsFormOpen(true) }
  const closeForm = () => { setIsFormOpen(false); setCurrentEditId(null); setEventForm(EMPTY_EVENT) }
  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  const openEditForm = (ev) => {
    setEventForm({
      name: ev.name,
      location: ev.location || '',
      start_date: ev.start_date,
      end_date: ev.end_date,
      category_ids: ev.category_ids,
      inscritos: ev.inscritos.map(i => ({ vehicle_id: i.vehicle_id, pilot_ids: i.pilot_ids })),
    })
    setCurrentEditId(ev.event_id)
    setIsFormOpen(true)
  }

  const alternarCategoria = (id) => {
    setEventForm(f => {
      const quitando = f.category_ids.includes(id)
      return {
        ...f,
        category_ids: quitando ? f.category_ids.filter(c => c !== id) : [...f.category_ids, id],
        // Al quitar una categoría se sacan sus carros: el backend rechaza
        // guardar inscritos de categorías que ya no corren.
        inscritos: quitando
          ? f.inscritos.filter(i => {
              const v = vehiculos.find(x => x.vehicle_id === i.vehicle_id)
              return v && v.category_id !== id
            })
          : f.inscritos,
      }
    })
  }

  const alternarVehiculo = (v) => {
    setEventForm(f => {
      if (f.inscritos.some(i => i.vehicle_id === v.vehicle_id)) {
        return { ...f, inscritos: f.inscritos.filter(i => i.vehicle_id !== v.vehicle_id) }
      }
      // Al inscribir un carro entran todos sus pilotos; lo normal es que
      // corran todos, y quitar es más rápido que agregar uno por uno.
      return {
        ...f,
        inscritos: [...f.inscritos, {
          vehicle_id: v.vehicle_id,
          pilot_ids: (v.pilots || []).map(p => p.pilot_id),
        }],
      }
    })
  }

  const alternarPiloto = (vehicleId, pilotId) => {
    setEventForm(f => ({
      ...f,
      inscritos: f.inscritos.map(i => {
        if (i.vehicle_id !== vehicleId) return i
        const dentro = i.pilot_ids.includes(pilotId)
        return {
          ...i,
          pilot_ids: dentro ? i.pilot_ids.filter(p => p !== pilotId) : [...i.pilot_ids, pilotId],
        }
      }),
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setGuardando(true)

    const cuerpo = {
      name: eventForm.name,
      location: eventForm.location || null,
      start_date: eventForm.start_date,
      end_date: eventForm.end_date,
      category_ids: eventForm.category_ids,
      inscritos: eventForm.inscritos,
    }

    try {
      if (currentEditId) {
        await eventosApi.actualizar(currentEditId, cuerpo)
        toast.exito('Evento actualizado', eventForm.name)
      } else {
        // Sin event_id: lo asigna el servidor, igual que en categorías.
        await eventosApi.crear({ ...cuerpo, discipline: disciplina })
        toast.exito('Evento creado', `${eventForm.name} · ${totalDias} día(s)`)
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
    const ev = porBorrar
    setPorBorrar(null)
    try {
      await eventosApi.eliminar(ev.event_id)
      toast.exito('Evento eliminado', ev.name)
      if (expandido?.event_id === ev.event_id) setExpandido(null)
      lista.recargar()
    } catch (err) {
      toast.error('No se pudo eliminar', err.message)
    }
  }

  // El programa devuelve el evento entero ya recalculado, así que se
  // refresca el panel abierto y la tabla con la misma respuesta.
  const alCambiarSesiones = (actualizado) => {
    setExpandido(actualizado)
    lista.recargar()
  }

  const columnas = puedeEscribir ? 6 : 5

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="eventos"
        searchText={lista.texto}
        onSearchChange={lista.setTexto}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO EVENTO"
        puedeCrear={puedeEscribir}
        exportData={() => eventosApi.listar({ ...filtros, search: lista.texto || undefined, sort_by: lista.sortBy, sort_dir: lista.sortDir }).then(p => p.items)}
        onExportError={m => toast.error('No se pudo exportar', m)}
        exportFileName="eventos"
        exportColumnMap={{ name: 'Evento', start_date: 'Inicio', end_date: 'Fin', location: 'Sede' }}
      />

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre del evento</label>
              <input required type="text" value={eventForm.name}
                onChange={e => setEventForm({ ...eventForm, name: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Fecha de inicio</label>
              <input required type="date" value={eventForm.start_date}
                onChange={e => setEventForm({ ...eventForm, start_date: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Fecha final</label>
              <input required type="date" value={eventForm.end_date}
                min={eventForm.start_date || undefined}
                onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Sede</label>
              <input type="text" value={eventForm.location} placeholder="Autódromo Panamá"
                onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div className="md:col-span-2 flex items-end">
              <p className="text-sm text-neutral-500">
                {totalDias > 0
                  ? <>Duración: <span className="text-white font-bold">{totalDias} día{totalDias > 1 ? 's' : ''}</span></>
                  : 'Elige las dos fechas para ver la duración.'}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-neutral-400 text-xs mb-2 uppercase">
              Categorías que corren ({eventForm.category_ids.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {categorias.map(c => {
                const activa = eventForm.category_ids.includes(c.category_id)
                return (
                  <button
                    key={c.category_id} type="button"
                    onClick={() => alternarCategoria(c.category_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      activa
                        ? 'bg-red-600/15 border-red-600 text-red-400'
                        : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {c.category_name}
                  </button>
                )
              })}
              {categorias.length === 0 && (
                <p className="text-sm text-neutral-600">No hay categorías en esta disciplina.</p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-neutral-400 text-xs mb-2 uppercase">
              Vehículos inscritos ({eventForm.inscritos.length})
            </label>

            {eventForm.category_ids.length === 0 ? (
              <p className="text-sm text-neutral-600 py-2">
                Elige primero las categorías; los vehículos se filtran por ellas.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto flex flex-col gap-2 p-1">
                {vehiculosElegibles.map(v => {
                  const ins = inscrito(v.vehicle_id)
                  return (
                    <div
                      key={v.vehicle_id}
                      className={`rounded-lg border transition-colors ${
                        ins ? 'border-red-600/60 bg-red-600/5' : 'border-neutral-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => alternarVehiculo(v)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left"
                      >
                        <span className={`inline-flex items-center justify-center min-w-[38px] h-8 px-2 rounded font-black font-mono text-sm ${
                          ins ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {v.display_number || v.number}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-white truncate">
                            {v.brand || 'Sin marca'} {v.model || ''}
                          </span>
                          <span className="block text-xs text-neutral-500">
                            {v.category_name}{v.sub_category_name ? ` · ${v.sub_category_name}` : ''}
                          </span>
                        </span>
                      </button>

                      {/* Los pilotos aparecen al inscribir el carro: quién
                          corre depende del vehículo, no al revés. */}
                      {ins && (v.pilots || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-[62px]">
                          {v.pilots.map(p => {
                            const corre = ins.pilot_ids.includes(p.pilot_id)
                            return (
                              <button
                                key={p.pilot_id} type="button"
                                onClick={() => alternarPiloto(v.vehicle_id, p.pilot_id)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                                  corre
                                    ? 'border-green-600/60 bg-green-600/10 text-green-400'
                                    : 'border-neutral-800 text-neutral-600 hover:border-neutral-600'
                                }`}
                              >
                                {p.name} {p.last_name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {vehiculosElegibles.length === 0 && (
                  <p className="text-sm text-neutral-600 py-2">
                    No hay vehículos en las categorías elegidas.
                  </p>
                )}
              </div>
            )}
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
              <th className="p-4 font-bold"><span className="flex items-center">Evento <SortIcon columnKey="name" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Fechas <SortIcon columnKey="start_date" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold">Categorías</th>
              <th className="p-4 font-bold text-right">Inscritos</th>
              <th className="p-4 font-bold text-right">Programa</th>
              {puedeEscribir && <th className="p-4 font-bold text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {lista.cargando && (
              <tr><td colSpan={columnas} className="p-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600"/>
              </td></tr>
            )}

            {!lista.cargando && lista.error && (
              <tr><td colSpan={columnas} className="p-10 text-center text-red-500">{lista.error.message}</td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.length === 0 && (
              <tr><td colSpan={columnas} className="p-10 text-center text-neutral-500">
                {lista.texto ? `Sin resultados para "${lista.texto}".` : 'No hay eventos registrados.'}
              </td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.map(ev => (
              <Fragment key={ev.event_id}>
                <tr className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                  <td className="p-4">
                    <p className="font-bold text-white italic">{ev.name}</p>
                    {ev.location && <p className="text-xs text-neutral-500 mt-0.5">{ev.location}</p>}
                  </td>
                  <td className="p-4 text-sm">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <CalendarDays size={13} className="text-red-500"/>
                      {ev.start_date} → {ev.end_date}
                    </span>
                    <p className="text-xs text-neutral-600 mt-0.5 pl-5">{ev.total_dias} día{ev.total_dias > 1 ? 's' : ''}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {ev.categorias.length
                        ? ev.categorias.map(n => (
                            <span key={n} className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-[11px] rounded font-bold">{n}</span>
                          ))
                        : <span className="text-neutral-600">—</span>}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="inline-flex items-center gap-1.5 text-sm text-neutral-300">
                      <Car size={13} className="text-neutral-600"/>{ev.total_inscritos}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setExpandido(expandido?.event_id === ev.event_id ? null : ev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                        expandido?.event_id === ev.event_id
                          ? 'border-red-600 bg-red-600/10 text-red-400'
                          : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                      }`}
                    >
                      <ListOrdered size={13}/>{ev.total_sesiones}
                    </button>
                  </td>
                  {puedeEscribir && (
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => openEditForm(ev)} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><Pencil size={15}/></button>
                      <button onClick={() => setPorBorrar(ev)} className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={15}/></button>
                    </td>
                  )}
                </tr>

                {expandido?.event_id === ev.event_id && (
                  <tr className="border-b border-neutral-800/50">
                    <td colSpan={columnas} className="p-4 bg-[#0f0f0f]">
                      <p className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
                        Programa por día
                      </p>
                      <SesionesEvento
                        evento={expandido}
                        onCambio={alCambiarSesiones}
                        puedeEscribir={puedeEscribir}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
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
        titulo="Eliminar evento"
        mensaje={porBorrar ? `Se va a eliminar ${porBorrar.name} con sus ${porBorrar.total_sesiones} sesión(es).` : ''}
        onCancelar={() => setPorBorrar(null)}
        onConfirmar={confirmarBorrado}
      />
    </div>
  )
}
