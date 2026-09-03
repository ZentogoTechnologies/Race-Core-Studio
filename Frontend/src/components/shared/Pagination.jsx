import { t } from '../../i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const TAMANOS = [10, 25, 50, 100]

/**
 * Controles de paginación.
 *
 * No decide nada por su cuenta: recibe el total que informó el backend y
 * avisa hacia arriba. Quien lo usa vuelve a pedir la página al servidor.
 */
export default function Pagination({ total, skip, limit, onCambiarPagina, onCambiarTamano }) {
  const paginaActual = Math.floor(skip / limit) + 1
  const totalPaginas = Math.max(1, Math.ceil(total / limit))

  const desde = total === 0 ? 0 : skip + 1
  const hasta = Math.min(skip + limit, total)

  const irA = (pagina) => onCambiarPagina((pagina - 1) * limit)

  // Ventana de páginas alrededor de la actual. Con 111 registros de 10 en
  // 10 son 12 páginas: dibujarlas todas satura la barra.
  const ventana = []
  const inicio = Math.max(1, Math.min(paginaActual - 2, totalPaginas - 4))
  const fin = Math.min(totalPaginas, Math.max(paginaActual + 2, 5))
  for (let p = inicio; p <= fin; p++) ventana.push(p)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-neutral-800 bg-neutral-900/40">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span>
          {total === 0
            ? 'Sin resultados'
            : <>{t('Mostrando')} <span className="text-neutral-300 font-bold">{desde}–{hasta}</span> de <span className="text-neutral-300 font-bold">{total}</span></>}
        </span>
        <select
          value={limit}
          onChange={e => onCambiarTamano(Number(e.target.value))}
          className="bg-[#0a0a0a] border border-neutral-800 rounded px-2 py-1 text-neutral-300 focus:outline-none focus:border-red-600"
          aria-label="Registros por página"
        >
          {TAMANOS.map(n => <option key={n} value={n}>{n} por página</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => irA(paginaActual - 1)}
          disabled={paginaActual <= 1}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {ventana.map(p => (
          <button
            key={p}
            onClick={() => irA(p)}
            aria-current={p === paginaActual ? 'page' : undefined}
            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-bold transition-colors ${
              p === paginaActual
                ? 'bg-red-600 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => irA(paginaActual + 1)}
          disabled={paginaActual >= totalPaginas}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
