import { AlertTriangle } from 'lucide-react'

/**
 * Confirmación para acciones que no se deshacen.
 *
 * Borrar un piloto o un vehículo no tiene vuelta atrás y el botón vive
 * justo al lado del de editar, así que un clic de más no puede bastar.
 */
export default function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  etiquetaConfirmar = 'ELIMINAR',
  onCancelar,
  onConfirmar,
}) {
  if (!abierto) return null

  return (
    // El clic en el fondo cancela; el de adentro se detiene para que
    // pulsar dentro de la tarjeta no cierre el diálogo.
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#141414] border border-red-600/40 rounded-xl p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-bold text-white">{titulo}</h3>
            <p className="text-sm text-neutral-400 mt-1">
              {mensaje} Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancelar}
            className="px-5 py-2 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors font-bold text-sm"
          >
            CANCELAR
          </button>
          <button
            onClick={onConfirmar}
            className="px-5 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors"
          >
            {etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
