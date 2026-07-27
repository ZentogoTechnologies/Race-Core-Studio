import { Timer, Map } from 'lucide-react'

// ==========================================
// 📁 src/components/events/EventSelectionScreen.jsx
// ==========================================
export default function EventSelectionScreen({ onSelectEvent }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12 animate-fade-in">
        <h2 className="text-4xl font-black text-white italic mb-4">
          SELECCIONA LA MODALIDAD
        </h2>
        <p className="text-neutral-400">
          Elige el tipo de evento que deseas gestionar en esta sesión.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Opción Drag */}
        <button
          onClick={() => onSelectEvent('drag')}
          className="group relative bg-[#141414] border border-neutral-800 hover:border-red-600 rounded-2xl p-10 overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(220,38,38,0.2)] text-left"
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-600/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <Timer size={48} className="text-red-600 mb-6 relative z-10" />
          <h3 className="text-3xl font-black text-white italic mb-2 relative z-10">
            DRAG RACING
          </h3>
          <p className="text-neutral-400 relative z-10">
            Gestión de 1/4 de milla, tiempos de reacción y llaves de eliminación.
          </p>
        </button>

        {/* Opción Circuito */}
        <button
          onClick={() => onSelectEvent('circuito')}
          className="group relative bg-[#141414] border border-neutral-800 hover:border-red-600 rounded-2xl p-10 overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(220,38,38,0.2)] text-left"
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-600/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <Map size={48} className="text-red-600 mb-6 relative z-10" />
          <h3 className="text-3xl font-black text-white italic mb-2 relative z-10">
            CIRCUITO
          </h3>
          <p className="text-neutral-400 relative z-10">
            Gestión de carreras de pista, vueltas, clasificaciones y endurance.
          </p>
        </button>
      </div>
    </div>
  )
}
