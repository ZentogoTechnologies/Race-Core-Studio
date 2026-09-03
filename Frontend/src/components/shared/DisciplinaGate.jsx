import { t } from '../../i18n'
import { Outlet } from 'react-router-dom'
import { Flag, Zap } from 'lucide-react'
import { useDisciplina } from '../../context/DisciplinaContext'
import { useAuth } from '../../context/AuthContext'

const OPCIONES = [
  {
    valor: 'circuito',
    etiqueta: 'Circuito',
    detalle: 'Carreras en pista: tandas, tótems y clasificación en vivo.',
    Icon: Flag,
  },
  {
    valor: 'drag',
    etiqueta: 'Drag',
    detalle: 'Carreras de aceleración por parejas.',
    Icon: Zap,
  },
]

/**
 * Pregunta la disciplina antes de dejar entrar a los módulos.
 *
 * La elección filtra categorías, pilotos y vehículos, así que tiene que
 * estar hecha antes de que cualquiera de esas pantallas pida datos: si se
 * preguntara después, la primera consulta saldría sin filtro y la tabla
 * parpadearía con registros de la otra disciplina.
 */
export default function DisciplinaGate() {
  const { disciplina, elegir } = useDisciplina()
  const { usuario } = useAuth()

  if (disciplina) return <Outlet />

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <img src="/Logo.png" alt="Race Core Studio" className="w-56 mx-auto object-contain mb-6" />
          <h1 className="text-2xl font-black italic tracking-wide text-white mb-2">
            ¿QUÉ VAS A GRAFICAR HOY?
          </h1>
          <p className="text-neutral-500 text-sm">
            {usuario ? `Hola, ${usuario.username}. ` : ''}
            {t('Elige la disciplina. Puedes cambiarla después desde el menú.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OPCIONES.map(({ valor, etiqueta, detalle, Icon }) => (
            <button
              key={valor}
              onClick={() => elegir(valor)}
              className="group bg-[#141414] border border-neutral-800 hover:border-red-600 rounded-xl p-8 text-left transition-colors"
            >
              <div className="bg-red-600/10 w-fit p-3 rounded-lg text-red-500 mb-5 group-hover:bg-red-600/20 transition-colors">
                <Icon size={26} />
              </div>
              <p className="text-xl font-black italic text-white mb-1">{t(etiqueta)}</p>
              <p className="text-neutral-500 text-sm leading-snug">{detalle}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
