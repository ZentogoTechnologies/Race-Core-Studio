import { useMemo, useState } from 'react'
import {
  Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Loader2,
  Shield, ShieldCheck, Eye, Crown,
} from 'lucide-react'
import ModuleHeader from '../components/shared/ModuleHeader'
import Pagination from '../components/shared/Pagination'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { usuariosApi } from '../api/registro'
import { useListado } from '../hooks/useListado'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const EMPTY_USER = { username: '', password: '', role: 'standard' }

// `owner` no está en la lista: no se reparte desde un formulario. El
// backend además lo rechaza con un 422, así que esconderlo aquí solo
// evita ofrecer algo que no va a funcionar.
const ROLES = [
  {
    valor: 'admin',
    etiqueta: 'Administrador',
    detalle: 'Todos los módulos, con permiso para crear, editar y borrar registros.',
    Icon: ShieldCheck,
    color: 'text-red-400 bg-red-600/10',
  },
  {
    valor: 'standard',
    etiqueta: 'Estándar',
    detalle: 'Entra a consultar información y a operar los gráficos, pero no modifica la base.',
    Icon: Eye,
    color: 'text-blue-400 bg-blue-500/10',
  },
]

const INSIGNIA = {
  owner:    { etiqueta: 'DUEÑO',    Icon: Crown,       clase: 'text-amber-400 bg-amber-500/10' },
  admin:    { etiqueta: 'ADMIN',    Icon: ShieldCheck, clase: 'text-red-400 bg-red-600/10' },
  standard: { etiqueta: 'ESTÁNDAR', Icon: Eye,         clase: 'text-blue-400 bg-blue-500/10' },
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

export default function UsuariosModule() {
  const toast = useToast()
  const { usuario } = useAuth()
  // '' = todos, 'true' = activos, 'false' = inactivos. Se filtra en el
  // backend, no sobre la página visible: hacerlo aquí dejaría el total y
  // la paginación mintiendo.
  const [estadoFiltro, setEstadoFiltro] = useState('')

  const filtros = useMemo(
    () => (estadoFiltro ? { active: estadoFiltro } : {}),
    [estadoFiltro],
  )

  const lista = useListado(usuariosApi, { ordenInicial: 'username', filtros })

  const [isFormOpen,    setIsFormOpen]    = useState(false)
  const [currentEditId, setCurrentEditId] = useState(null)
  const [userForm,      setUserForm]      = useState(EMPTY_USER)
  const [guardando,     setGuardando]     = useState(false)
  const [porBorrar,     setPorBorrar]     = useState(null)

  const editandoOwner = currentEditId && userForm.role === 'owner'
  const soyYo = (u) => u.user_id === usuario?.user_id

  // Dar de baja en vez de borrar: el usuario desaparece del sistema pero
  // se conserva quién hizo qué. Ni al dueño ni a uno mismo, que es lo
  // mismo que ya impide el borrado: quedarse fuera de la aplicación.
  const alternarActivo = async (u) => {
    try {
      await usuariosApi.actualizar(u.user_id, { active: !u.active })
      lista.recargar()
      toast.exito(u.active ? 'Usuario inactivo' : 'Usuario activo', u.username)
    } catch (err) {
      toast.error('No se pudo cambiar el estado', err.message)
    }
  }

  const openAddForm  = () => { setUserForm(EMPTY_USER); setCurrentEditId(null); setIsFormOpen(true) }
  const closeForm    = () => { setIsFormOpen(false); setCurrentEditId(null); setUserForm(EMPTY_USER) }
  const handleFormToggle = () => isFormOpen ? closeForm() : openAddForm()

  const openEditForm = (u) => {
    // La contraseña nunca vuelve del backend, y no debería: se deja vacía
    // y solo se manda si el dueño escribe una nueva.
    setUserForm({ username: u.username, password: '', role: u.role })
    setCurrentEditId(u.user_id)
    setIsFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setGuardando(true)

    try {
      if (currentEditId) {
        const cambios = { username: userForm.username }
        if (userForm.password) cambios.password = userForm.password
        // Al dueño no se le toca el rol, ni el suyo propio: el backend lo
        // rechaza y dejaría al sistema sin quien administre cuentas.
        if (userForm.role !== 'owner' && currentEditId !== usuario?.user_id) {
          cambios.role = userForm.role
        }

        await usuariosApi.actualizar(currentEditId, cambios)
        toast.exito('Usuario actualizado', userForm.username)
      } else {
        await usuariosApi.crear(userForm)
        toast.exito('Usuario creado', `${userForm.username} · ${userForm.role}`)
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
    const u = porBorrar
    setPorBorrar(null)

    try {
      await usuariosApi.eliminar(u.user_id)
      toast.exito('Usuario eliminado', u.username)
      lista.recargar()
    } catch (err) {
      toast.error('No se pudo eliminar', err.message)
    }
  }

  return (
    <div className="w-full animate-fade-in">
      <ModuleHeader
        entityName="usuarios"
        searchText={lista.texto}
        onSearchChange={lista.setTexto}
        isFormOpen={isFormOpen}
        onFormToggle={handleFormToggle}
        addButtonLabel="NUEVO USUARIO"
        exportData={() => usuariosApi.listar({ search: lista.texto || undefined, sort_by: lista.sortBy, sort_dir: lista.sortDir }).then(p => p.items)}
        onExportError={m => toast.error('No se pudo exportar', m)}
        exportFileName="usuarios"
        exportColumnMap={{ username: 'Usuario', role: 'Rol', created_at: 'Creado', active: 'Activo' }}
      />

      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs uppercase tracking-wider text-neutral-500">Estado</label>
        <select
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value)}
          className="bg-[#141414] border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-red-600"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Usuario</label>
              <input
                required type="text" minLength={3} value={userForm.username}
                autoComplete="off"
                onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 uppercase">
                Contraseña {currentEditId && <span className="text-neutral-600 normal-case">— vacía la deja igual</span>}
              </label>
              <input
                type="password" minLength={4} required={!currentEditId}
                value={userForm.password} autoComplete="new-password"
                placeholder={currentEditId ? '••••••••' : ''}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white"/>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-neutral-400 text-xs mb-2 uppercase">Rol</label>

            {editandoOwner ? (
              <p className="text-sm text-neutral-500 bg-[#0a0a0a] border border-neutral-800 rounded p-3">
                El rol de dueño no se cambia desde aquí. Se asigna con el script
                <span className="text-neutral-300 font-mono"> seed_admin.py</span>.
              </p>
            ) : currentEditId === usuario?.user_id ? (
              <p className="text-sm text-neutral-500 bg-[#0a0a0a] border border-neutral-800 rounded p-3">
                No puedes cambiar tu propio rol.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(({ valor, etiqueta, detalle, Icon, color }) => {
                  const activo = userForm.role === valor
                  return (
                    <button
                      key={valor} type="button"
                      onClick={() => setUserForm({ ...userForm, role: valor })}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        activo ? 'border-red-600 bg-red-600/5' : 'border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <div className={`w-fit p-2 rounded mb-2 ${color}`}><Icon size={16}/></div>
                      <p className={`font-bold text-sm ${activo ? 'text-white' : 'text-neutral-300'}`}>{etiqueta}</p>
                      <p className="text-xs text-neutral-500 mt-1 leading-snug">{detalle}</p>
                    </button>
                  )
                })}
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
              <th className="p-4 font-bold"><span className="flex items-center">Usuario <SortIcon columnKey="username" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Rol <SortIcon columnKey="role" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold"><span className="flex items-center">Creado <SortIcon columnKey="created_at" sortField={lista.sortBy} sortDirection={lista.sortDir} onSort={lista.ordenarPor}/></span></th>
              <th className="p-4 font-bold text-right">Estado</th>
              <th className="p-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.cargando && (
              <tr><td colSpan={5} className="p-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600"/>
              </td></tr>
            )}

            {!lista.cargando && lista.error && (
              <tr><td colSpan={5} className="p-10 text-center text-red-500">{lista.error.message}</td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-neutral-500">
                {lista.texto ? `Sin resultados para "${lista.texto}".` : 'No hay usuarios registrados.'}
              </td></tr>
            )}

            {!lista.cargando && !lista.error && lista.items.map(u => {
              const insignia = INSIGNIA[u.role] || INSIGNIA.standard
              const esOwner = u.role === 'owner'
              return (
                <tr key={u.user_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 flex-shrink-0">
                        <Shield size={16}/>
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          {u.username}
                          {soyYo(u) && <span className="ml-2 text-[11px] text-neutral-500 font-normal">(tú)</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold ${insignia.clase}`}>
                      <insignia.Icon size={12}/>{insignia.etiqueta}
                    </span>
                  </td>
                  <td className="p-4 text-neutral-400 text-sm font-mono">{u.created_at}</td>
                  <td className="p-4 text-right">
                    {/* La insignia es el interruptor. Al dueño y a uno mismo
                        se les deja como etiqueta: desactivarse a sí mismo
                        cierra la puerta desde dentro. */}
                    {!esOwner && !soyYo(u) ? (
                      <button
                        type="button"
                        onClick={() => alternarActivo(u)}
                        title={u.active ? 'Dar de baja' : 'Reactivar'}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${
                          u.active
                            ? 'bg-green-500/10 text-green-500 border-green-600/40 hover:bg-green-500/20'
                            : 'bg-neutral-700/30 text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        {u.active ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    ) : (
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        u.active ? 'bg-green-500/10 text-green-500' : 'bg-neutral-700/30 text-neutral-500'
                      }`}>
                        {u.active ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => openEditForm(u)} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><Pencil size={15}/></button>
                    {/* Ni al dueño ni a uno mismo: el backend rechaza las dos
                        cosas, así que el botón solo prometería algo falso. */}
                    {!esOwner && !soyYo(u) && (
                      <button onClick={() => setPorBorrar(u)} className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={15}/></button>
                    )}
                  </td>
                </tr>
              )
            })}
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
        titulo="Eliminar usuario"
        mensaje={porBorrar ? `Se va a eliminar la cuenta ${porBorrar.username}.` : ''}
        onCancelar={() => setPorBorrar(null)}
        onConfirmar={confirmarBorrado}
      />
    </div>
  )
}
