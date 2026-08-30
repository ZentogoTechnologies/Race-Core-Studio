import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, Upload, User, X } from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'
import Pagination from '../components/shared/Pagination'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import {
  borrarFotoPiloto, categoriasApi, pilotosApi, subirFotoPiloto, urlFotoPiloto,
} from '../api/registro'
import { useListado } from '../hooks/useListado'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useDisciplina } from '../context/DisciplinaContext'

// Sin discipline: la hereda del selector global. Si el formulario dejara
// elegirla, crear un piloto de la otra disciplina solo serviría para que
// desapareciera de la lista al guardarlo.
const EMPTY_PILOT = {
  name: '', last_name: '', nationality: '',
  team_brand: '', category_ids: [],
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

export default function PilotosModule() {
  const toast = useToast()
  const { puedeEscribir } = useAuth()
  const { disciplina } = useDisciplina()

  // El filtro por categoría se manda al backend, no se aplica sobre la
  // página visible: filtrar aquí dejaría el total y las páginas mintiendo.
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  // La disciplina viaja siempre; la categoría solo si se eligió una.
  const filtros = useMemo(
    () => ({
      discipline: disciplina,
      ...(categoriaFiltro ? { category_id: categoriaFiltro } : {}),
    }),
    [disciplina, categoriaFiltro],
  )

  const lista = useListado(pilotosApi, { ordenInicial: 'last_name', filtros })

  const [categorias,    setCategorias]    = useState([])
  const [isFormOpen,    setIsFormOpen]    = useState(false)
  const [currentEditId, setCurrentEditId] = useState(null)
  const [pilotForm,     setPilotForm]     = useState(EMPTY_PILOT)
  const [guardando,     setGuardando]     = useState(false)
  const [porBorrar,     setPorBorrar]     = useState(null)

  // Las categorías se traen enteras una sola vez: son seis y alimentan
  // tanto el filtro de arriba como el selector del formulario.
  useEffect(() => {
    categoriasApi.listar({ sort_by: 'category_name', discipline: disciplina })
      .then(p => setCategorias(p.items))
      .catch(err => toast.error('No se pudieron cargar las categorías', err.message))
  }, [disciplina])   // eslint-disable-line react-hooks/exhaustive-deps

  const nombreCategoria = (id) =>
    categorias.find(c => c.category_id === id)?.category_name || `#${id}`

  // La foto se maneja aparte del resto del formulario: no viaja en el JSON
  // del piloto sino como archivo, y en un alta todavía no hay id al que
  // asociarla, así que se guarda aquí y se sube en cuanto el piloto existe.
  const [foto, setFoto] = useState(null)          // File elegido, sin subir
  const [fotoActual, setFotoActual] = useState(null)   // ruta ya guardada
  const inputFoto = useRef(null)

  // Vista previa de lo elegido antes de subirlo. Se revoca al cambiar para
  // no ir dejando URLs de objeto vivas en memoria.
  const [previa, setPrevia] = useState(null)
  useEffect(() => {
    if (!foto) { setPrevia(null); return }
    const url = URL.createObjectURL(foto)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  const limpiarFoto = () => {
    setFoto(null)
    setFotoActual(null)
    if (inputFoto.current) inputFoto.current.value = ''
  }

  const openAddForm  = () => { setPilotForm(EMPTY_PILOT); setCurrentEditId(null); limpiarFoto(); setIsFormOpen(true) }
  const closeForm    = () => { setIsFormOpen(false); setCurrentEditId(null); setPilotForm(EMPTY_PILOT); limpiarFoto() }
  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  const openEditForm = (piloto) => {
    setPilotForm({
      pilot_id: piloto.pilot_id,
      name: piloto.name,
      last_name: piloto.last_name,
      nationality: piloto.nationality || '',
      team_brand: piloto.team_brand || '',
      category_ids: piloto.categories || [],
    })
    setCurrentEditId(piloto.pilot_id)
    setFoto(null)
    setFotoActual(piloto.photo || null)
    if (inputFoto.current) inputFoto.current.value = ''
    setIsFormOpen(true)
  }

  const quitarFoto = async () => {
    if (!currentEditId) { limpiarFoto(); return }
    try {
      await borrarFotoPiloto(currentEditId)
      limpiarFoto()
      lista.recargar()
      toast.exito('Foto quitada', 'El gráfico usará la silueta de reserva')
    } catch (err) {
      toast.error('No se pudo quitar la foto', err.message)
    }
  }

  const alternarCategoria = (id) => {
    setPilotForm(f => ({
      ...f,
      category_ids: f.category_ids.includes(id)
        ? f.category_ids.filter(c => c !== id)
        : [...f.category_ids, id],
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setGuardando(true)

    // El modelo la guarda como lista porque un piloto puede correr en las
    // dos disciplinas. Aquí se manda la activa; para que corra en ambas
    // habría que cargarlo desde cada una.
    const cuerpo = {
      name: pilotForm.name,
      last_name: pilotForm.last_name,
      nationality: pilotForm.nationality || null,
      team_brand: pilotForm.team_brand || null,
      category_ids: pilotForm.category_ids,
      discipline: [disciplina],
    }

    try {
      let id = currentEditId

      if (currentEditId) {
        await pilotosApi.actualizar(currentEditId, cuerpo)
        toast.exito('Piloto actualizado', `${pilotForm.name} ${pilotForm.last_name}`)
      } else {
        // Sin pilot_id: lo asigna el backend, que es el único que sabe
        // cuál está libre aunque haya dos altas a la vez.
        const creado = await pilotosApi.crear(cuerpo)
        id = creado.pilot_id
        toast.exito('Piloto creado', `${pilotForm.name} ${pilotForm.last_name}`)
      }

      // Va después de guardar porque en un alta el id no existe hasta
      // ahora. Si falla la foto no se deshace el piloto: se avisa y ya,
      // que volver a intentarlo es abrir y elegir el archivo otra vez.
      if (foto && id) {
        try {
          await subirFotoPiloto(id, foto)
        } catch (err) {
          toast.error('El piloto se guardó, pero la foto no', err.message)
        }
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
    const piloto = porBorrar
    setPorBorrar(null)

    try {
      await pilotosApi.eliminar(piloto.pilot_id)
      toast.exito('Piloto eliminado', `${piloto.name} ${piloto.last_name}`)
      lista.recargar()
    } catch (err) {
      toast.error('No se pudo eliminar', err.message)
    }
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="pilotos"
        searchText={lista.texto}
        onSearchChange={lista.setTexto}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO PILOTO"
        puedeCrear={puedeEscribir}
        exportData={() => pilotosApi.listar({ ...filtros, search: lista.texto || undefined, sort_by: lista.sortBy, sort_dir: lista.sortDir }).then(p => p.items)}
        onExportError={m => toast.error('No se pudo exportar', m)}
        exportFileName="pilotos"
        exportColumnMap={{ pilot_id: 'ID', name: 'Nombre', last_name: 'Apellido', nationality: 'Nacionalidad', team_brand: 'Equipo' }}
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
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre</label>
            <input required type="text" value={pilotForm.name}
              onChange={e => setPilotForm({ ...pilotForm, name: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Apellido</label>
            <input required type="text" value={pilotForm.last_name}
              onChange={e => setPilotForm({ ...pilotForm, last_name: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Nacionalidad</label>
            <input type="text" value={pilotForm.nationality} placeholder="Panama"
              onChange={e => setPilotForm({ ...pilotForm, nationality: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Equipo</label>
            <input type="text" value={pilotForm.team_brand}
              onChange={e => setPilotForm({ ...pilotForm, team_brand: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
          </div>
          <div className="col-span-full flex items-center gap-4 border-t border-neutral-800 pt-4">

            <div className="w-20 h-20 rounded-lg bg-[#0a0a0a] border border-neutral-800 overflow-hidden flex items-center justify-center flex-shrink-0">
              {previa || fotoActual
                ? <img src={previa || urlFotoPiloto(fotoActual)} alt="" className="w-full h-full object-cover"/>
                : <User size={26} className="text-neutral-700"/>}
            </div>

            <div className="min-w-0">
              <label className="block text-neutral-400 text-xs mb-2 uppercase">Foto del piloto</label>

              <input
                type="file" accept="image/*" ref={inputFoto} className="hidden"
                onChange={e => setFoto(e.target.files?.[0] || null)}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button" onClick={() => inputFoto.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-400 transition-colors font-bold text-xs"
                >
                  <Upload size={14}/>
                  {previa || fotoActual ? 'CAMBIAR' : 'ELEGIR FOTO'}
                </button>

                {(previa || fotoActual) && (
                  <button
                    type="button" onClick={quitarFoto}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-800 text-neutral-500 hover:border-red-600 hover:text-red-500 transition-colors font-bold text-xs"
                  >
                    <X size={14}/> QUITAR
                  </button>
                )}
              </div>

              {/* Se avisa porque la foto no se sube al elegirla: en un alta
                  todavía no hay piloto al que asociarla. */}
              <p className="text-[11px] text-neutral-600 mt-2">
                {foto
                  ? 'Se sube al guardar el piloto.'
                  : 'La usan la ficha del piloto y la grilla con fotos.'}
              </p>
            </div>
          </div>

          <div className="col-span-full">
            <label className="block text-neutral-400 text-xs mb-2 uppercase">Categorías</label>
            <div className="flex flex-wrap gap-2">
              {categorias.map(c => {
                const activa = pilotForm.category_ids.includes(c.category_id)
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
            </div>
          </div>

          <div className="col-span-full flex justify-end gap-3 mt-2">
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
              <th className="p-4 font-bold"><span className="flex items-center">Piloto <SortIcon columnKey="last_name" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Nacionalidad <SortIcon columnKey="nationality" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Equipo <SortIcon columnKey="team_brand" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold">Categorías</th>
              <th className="p-4 font-bold text-right">Estado</th>
              {puedeEscribir && <th className="p-4 font-bold text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {lista.cargando && (
              <tr><td colSpan={puedeEscribir ? 6 : 5} className="p-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600"/>
              </td></tr>
            )}

            {!lista.cargando && lista.error && (
              <tr><td colSpan={puedeEscribir ? 6 : 5} className="p-10 text-center text-red-500">{lista.error.message}</td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.length === 0 && (
              <tr><td colSpan={puedeEscribir ? 6 : 5} className="p-10 text-center text-neutral-500">
                {lista.texto ? `Sin resultados para "${lista.texto}".` : 'No hay pilotos registrados.'}
              </td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.map(piloto => (
              <tr key={piloto.pilot_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-red-500 font-bold flex-shrink-0">
                      {piloto.name.charAt(0)}{piloto.last_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white">{piloto.name} <span className="uppercase">{piloto.last_name}</span></p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-neutral-300 text-sm">{piloto.nationality || <span className="text-neutral-600">—</span>}</td>
                <td className="p-4 text-neutral-300 text-sm">{piloto.team_brand || <span className="text-neutral-600">—</span>}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {piloto.categories?.length
                      ? piloto.categories.map(id => (
                          <span key={id} className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-[11px] rounded font-bold">
                            {nombreCategoria(id)}
                          </span>
                        ))
                      : <span className="text-neutral-600">—</span>}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                    piloto.is_active ? 'bg-green-500/10 text-green-500' : 'bg-neutral-700/30 text-neutral-500'
                  }`}>
                    {piloto.is_active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                {puedeEscribir && (
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => openEditForm(piloto)} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><Pencil size={15}/></button>
                    <button onClick={() => setPorBorrar(piloto)} className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={15}/></button>
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
        titulo="Eliminar piloto"
        mensaje={porBorrar ? `Se va a eliminar ${porBorrar.name} ${porBorrar.last_name}.` : ''}
        onCancelar={() => setPorBorrar(null)}
        onConfirmar={confirmarBorrado}
      />
    </div>
  )
}
