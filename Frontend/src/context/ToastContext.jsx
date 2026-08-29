import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

// Los errores se quedan más tiempo: casi siempre traen texto del servidor
// que el operador necesita alcanzar a leer antes de que desaparezca.
const DURACION = { exito: 3500, error: 6000, info: 4000 }

const ESTILOS = {
  exito: { Icon: CheckCircle2, borde: 'border-green-500/40', icono: 'text-green-400', barra: 'bg-green-500' },
  error: { Icon: AlertCircle, borde: 'border-red-600/50',   icono: 'text-red-500',   barra: 'bg-red-600' },
  info:  { Icon: Info,        borde: 'border-neutral-700',  icono: 'text-neutral-300', barra: 'bg-neutral-500' },
}

function Toast({ toast, onCerrar }) {
  const { Icon, borde, icono, barra } = ESTILOS[toast.tipo] || ESTILOS.info

  return (
    <div
      role="status"
      className={`pointer-events-auto w-80 bg-[#141414] border ${borde} rounded-lg shadow-2xl overflow-hidden animate-toast-in`}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon size={20} className={`${icono} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{toast.titulo}</p>
          {toast.detalle && (
            <p className="text-xs text-neutral-400 mt-1 break-words">{toast.detalle}</p>
          )}
        </div>
        <button
          onClick={() => onCerrar(toast.id)}
          className="text-neutral-600 hover:text-white transition-colors flex-shrink-0"
          aria-label="Cerrar aviso"
        >
          <X size={15} />
        </button>
      </div>
      {/* La barra marca cuánto le queda en pantalla. */}
      <div
        className={`h-0.5 ${barra} animate-toast-bar`}
        style={{ animationDuration: `${toast.duracion}ms` }}
      />
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Los timers se guardan para poder limpiarlos al desmontar: si no, un
  // setTimeout pendiente intenta tocar el estado de un componente muerto.
  const timers = useRef(new Map())

  const cerrar = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const mostrar = useCallback((tipo, titulo, detalle) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const duracion = DURACION[tipo] || DURACION.info

    setToasts(prev => {
      // Tope de 4 en pantalla: si el operador dispara varias acciones
      // seguidas, la pila no debe taparle la tabla.
      const siguiente = [...prev, { id, tipo, titulo, detalle, duracion }]
      return siguiente.slice(-4)
    })

    timers.current.set(id, setTimeout(() => cerrar(id), duracion))
    return id
  }, [cerrar])

  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
  }, [])

  const valor = {
    exito: (titulo, detalle) => mostrar('exito', titulo, detalle),
    error: (titulo, detalle) => mostrar('error', titulo, detalle),
    info:  (titulo, detalle) => mostrar('info', titulo, detalle),
    cerrar,
  }

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {/* pointer-events-none en el contenedor para no bloquear los clics
          de la tabla que queda debajo; cada toast lo reactiva para sí. */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => <Toast key={t.id} toast={t} onCerrar={cerrar} />)}
      </div>
    </ToastContext.Provider>
  )
}
