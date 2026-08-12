import { BarChart3 } from 'lucide-react'

export default function GraficosModule() {
  return (
    <div className="w-full animate-fade-in">
      <div className="bg-[#141414] rounded-xl border border-neutral-800 flex flex-col items-center justify-center py-24 text-neutral-500">
        <BarChart3 size={40} className="mb-4 text-neutral-700" />
        <p className="text-sm">Módulo de gráficos en construcción.</p>
      </div>
    </div>
  )
}
