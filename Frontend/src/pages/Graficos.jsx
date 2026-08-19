import { useState } from 'react'
import {
  Flag, Siren, CloudSun, Mic, Calendar, Share2, Map,
  SquareUser, Contact, ListOrdered, List, Crown, ArrowUpDown, LayoutGrid,
  Radio, PowerOff, Search, Eye, EyeOff,
} from 'lucide-react'

// ─── Ícono personalizado: bandera a cuadros ───────────────────
// lucide-react no incluye una bandera a cuadros, se dibuja con el
// mismo lenguaje visual del set (24x24, stroke 2, esquinas redondeadas).
function CheckeredFlag({ size = 24, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M4 22V4" />
      <path d="M4 4h8v5H4zM12 9h8v5h-8z" fill="currentColor" stroke="none" />
      <rect x="4" y="4" width="16" height="10" />
    </svg>
  )
}

// ─── Muestras de color para los fondos ────────────────────────
function ColorSwatch({ size = 24, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" stroke="currentColor" strokeWidth="2"
      strokeLinejoin="round" className={className}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  )
}

function EmptySwatch({ size = 24, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m6 18 12-12" />
    </svg>
  )
}

// ─── Paleta roja compartida por misceláneos y pilotos ─────────
const ROJO = {
  icon: 'text-red-500', border: 'border-red-600',
  bgActive: 'bg-red-600/10', dot: 'bg-red-500',
}

// ─── Fondos: colores planos de transmisión ────────────────────
const BACKGROUNDS = [
  { id: 'bg-none',    label: 'Sin Fondo', nombre: 'Sin Fondo',      detalle: 'Negro, sin fondo', Icon: EmptySwatch,
    icon: 'text-neutral-400', border: 'border-neutral-400', bgActive: 'bg-neutral-400/10', dot: 'bg-neutral-400' },
  { id: 'bg-red',     label: 'Rojo',      nombre: 'Fondo Rojo',     detalle: 'Fondo rojo',       Icon: ColorSwatch,
    icon: 'text-red-500',     border: 'border-red-600',     bgActive: 'bg-red-600/10',     dot: 'bg-red-500' },
  { id: 'bg-cyan',    label: 'Cian',      nombre: 'Fondo Cian',     detalle: 'Fondo cian',       Icon: ColorSwatch,
    icon: 'text-cyan-400',    border: 'border-cyan-400',    bgActive: 'bg-cyan-400/10',    dot: 'bg-cyan-400' },
  { id: 'bg-blue',    label: 'Azul',      nombre: 'Fondo Azul',     detalle: 'Fondo azul',       Icon: ColorSwatch,
    icon: 'text-blue-500',    border: 'border-blue-500',    bgActive: 'bg-blue-500/10',    dot: 'bg-blue-500' },
  { id: 'bg-green',   label: 'Verde',     nombre: 'Fondo Verde',    detalle: 'Fondo verde',      Icon: ColorSwatch,
    icon: 'text-green-500',   border: 'border-green-500',   bgActive: 'bg-green-500/10',   dot: 'bg-green-500' },
  { id: 'bg-yellow',  label: 'Amarillo',  nombre: 'Fondo Amarillo', detalle: 'Fondo amarillo',   Icon: ColorSwatch,
    icon: 'text-yellow-400',  border: 'border-yellow-400',  bgActive: 'bg-yellow-400/10',  dot: 'bg-yellow-400' },
  { id: 'bg-magenta', label: 'Magenta',   nombre: 'Fondo Magenta',  detalle: 'Fondo magenta',    Icon: ColorSwatch,
    icon: 'text-fuchsia-500', border: 'border-fuchsia-500', bgActive: 'bg-fuchsia-500/10', dot: 'bg-fuchsia-500' },
]

// ─── Banderas: en orden de carrera, cada una con su color ─────
const BANDERAS = [
  { id: 'bandera-verde',    label: 'Verde',      nombre: 'Bandera Verde',      detalle: 'Pista habilitada',            Icon: Flag,
    icon: 'text-green-500',  border: 'border-green-500',  bgActive: 'bg-green-500/10',  dot: 'bg-green-500' },
  { id: 'bandera-amarilla', label: 'Amarilla',   nombre: 'Bandera Amarilla',   detalle: 'Precaución en pista',         Icon: Flag,
    icon: 'text-yellow-400', border: 'border-yellow-400', bgActive: 'bg-yellow-400/10', dot: 'bg-yellow-400' },
  { id: 'safety-car',       label: 'Safety Car', nombre: 'Safety Car',         detalle: 'Coche de seguridad en pista', Icon: Siren,
    icon: 'text-orange-400', border: 'border-orange-500', bgActive: 'bg-orange-500/10', dot: 'bg-orange-400' },
  { id: 'bandera-roja',     label: 'Roja',       nombre: 'Bandera Roja',       detalle: 'Carrera detenida',            Icon: Flag,
    icon: 'text-red-500',    border: 'border-red-600',    bgActive: 'bg-red-600/10',    dot: 'bg-red-500' },
  { id: 'bandera-cuadros',  label: 'Cuadros',    nombre: 'Bandera de Cuadros', detalle: 'Fin de carrera',              Icon: CheckeredFlag,
    icon: 'text-white',      border: 'border-white',      bgActive: 'bg-white/10',      dot: 'bg-white' },
]

// ─── Misceláneos ──────────────────────────────────────────────
const MISCELANEOS = [
  { id: 'clima',    label: 'Clima',    nombre: 'Clima',          detalle: 'Condiciones de pista',        Icon: CloudSun, ...ROJO },
  { id: 'narrador', label: 'Narrador', nombre: 'Narrador',       detalle: 'Identificación del narrador', Icon: Mic,      ...ROJO },
  { id: 'evento',   label: 'Evento',   nombre: 'Evento',         detalle: 'Datos del evento en curso',   Icon: Calendar, ...ROJO },
  { id: 'redes',    label: 'Redes',    nombre: 'Redes Sociales', detalle: 'Cuentas oficiales',           Icon: Share2,   ...ROJO },
  { id: 'circuito', label: 'Circuito', nombre: 'Circuito',       detalle: 'Imagen de la pista',          Icon: Map,      ...ROJO },
]

// ─── Pilotos ──────────────────────────────────────────────────
const PILOTOS = [
  { id: 'ficha-corta',     label: 'Ficha Corta',     nombre: 'Ficha Corta',
    detalle: 'Datos básicos del piloto',                              Icon: SquareUser,  ...ROJO },
  { id: 'ficha-completa',  label: 'Ficha Completa',  nombre: 'Ficha Completa',
    detalle: 'Ficha completa del piloto',                             Icon: Contact,     ...ROJO },
  { id: 'totem-completo',  label: 'Tótem Completo',  nombre: 'Tótem Nombre Completo',
    detalle: 'Clasificación con el nombre completo',                  Icon: ListOrdered, ...ROJO },
  { id: 'totem-corto',     label: 'Tótem Corto',     nombre: 'Tótem Nombre Corto',
    detalle: 'Clasificación con el nombre abreviado',                 Icon: List,        ...ROJO },
  { id: 'totem-lider',     label: 'Tótem Líder',     nombre: 'Tótem al Líder',
    detalle: 'Diferencia de cada piloto contra el líder',             Icon: Crown,       ...ROJO },
  { id: 'totem-intervalo', label: 'Tótem Intervalo', nombre: 'Tótem Intervalo',
    detalle: 'Diferencia entre cada piloto y el que va adelante',     Icon: ArrowUpDown, ...ROJO },
  { id: 'grilla',          label: 'Grilla',          nombre: 'Grilla de Partida',
    detalle: 'Posiciones de largada, de dos en dos',                  Icon: LayoutGrid,  ...ROJO },
]

// Capa de gráfico: banderas, misceláneos y pilotos compiten entre sí.
// Los fondos viven en su propia capa, detrás, y son independientes.
const GRAFICOS = [...BANDERAS, ...MISCELANEOS, ...PILOTOS]

// Misma grilla en las tres secciones para que las columnas queden alineadas.
const GRID = 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3'

// ─── Botón de gráfico ─────────────────────────────────────────
function GraphicButton({ item, isActive, isEditing, onClick }) {
  const { Icon, label, detalle } = item
  return (
    <button
      type="button"
      onClick={onClick}
      title={detalle}
      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
        isActive
          ? `${item.border} ${item.bgActive} text-white`
          : isEditing
            ? 'border-neutral-500 bg-neutral-900 text-white'
            : 'border-neutral-800 bg-[#0a0a0a] text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900'
      }`}
    >
      <Icon size={20} className={`flex-shrink-0 ${item.icon}`} />
      <span className="font-semibold text-sm truncate">{label}</span>
      {/* Fuera del flujo: el ancho del botón no cambia al activarse */}
      {isActive && (
        <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${item.dot} animate-pulse`} />
      )}
    </button>
  )
}

// ─── Gráficos que requieren datos antes de salir al aire ──────
// El botón ya define el tipo, así que el formulario no lo vuelve a preguntar.
const REQUIERE_DATOS = {
  'narrador':       'narrador',  // se escribe al momento, no se guarda
  'ficha-corta':    'piloto',    // sale del registro de pilotos
  'ficha-completa': 'piloto',
}

// ─── Formulario en línea ──────────────────────────────────────
function FormularioPersonal({
  item, tipo, pilotosRegistrados,
  narrador, setNarrador, pilotoId, setPilotoId,
  alAire, onMostrar, onOcultar,
}) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = pilotosRegistrados.filter(p =>
    `${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )
  const pilotoElegido = pilotosRegistrados.find(p => p.id === pilotoId) || null

  const listo = tipo === 'narrador'
    ? narrador.nombre.trim() !== ''
    : pilotoId !== null

  const inputClass = 'w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white'

  return (
    <div className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mt-4">
      <p className="text-white font-bold text-sm uppercase tracking-wider mb-4">
        {item.nombre}
      </p>

      {tipo === 'narrador' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre</label>
            <input
              type="text" value={narrador.nombre} className={inputClass}
              onChange={e => setNarrador({ ...narrador, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-neutral-400 text-xs mb-1 uppercase">Equipo / Canal</label>
            <input
              type="text" value={narrador.equipo} className={inputClass}
              onChange={e => setNarrador({ ...narrador, equipo: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-neutral-400 text-xs mb-1 uppercase">Piloto</label>

          {pilotoElegido ? (
            <div className="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-red-600/40 rounded p-2">
              <span className="text-white font-semibold text-sm truncate">
                {pilotoElegido.nombre} <span className="uppercase">{pilotoElegido.apellido}</span>
              </span>
              <button
                type="button"
                onClick={() => { setPilotoId(null); setBusqueda('') }}
                className="text-neutral-400 hover:text-white text-xs font-bold flex-shrink-0"
              >
                CAMBIAR
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                <input
                  type="text" value={busqueda} placeholder="Buscar piloto..."
                  onChange={e => setBusqueda(e.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>

              <div className="mt-2 max-h-44 overflow-y-auto rounded border border-neutral-800 divide-y divide-neutral-800/60">
                {pilotosRegistrados.length === 0 ? (
                  <p className="p-3 text-neutral-500 text-sm">
                    No hay pilotos registrados todavía.
                  </p>
                ) : filtrados.length === 0 ? (
                  <p className="p-3 text-neutral-500 text-sm">Sin coincidencias.</p>
                ) : (
                  filtrados.map(p => (
                    <button
                      key={p.id} type="button"
                      onClick={() => setPilotoId(p.id)}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                      {p.nombre} <span className="uppercase">{p.apellido}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button" onClick={onOcultar} disabled={!alAire}
          className="flex items-center gap-2 px-5 py-2 rounded border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10 transition-all font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:text-neutral-300 disabled:hover:bg-transparent"
        >
          <EyeOff size={16} />
          OCULTAR
        </button>
        <button
          type="button" onClick={onMostrar} disabled={!listo}
          className="flex items-center gap-2 bg-white text-black font-bold py-2 px-6 rounded hover:bg-neutral-200 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye size={16} />
          MOSTRAR GRÁFICO
        </button>
      </div>
    </div>
  )
}

// ─── Pestañas ─────────────────────────────────────────────────
// 'capa' indica sobre qué estado actúa cada grupo.
const TABS = [
  { id: 'backgrounds', titulo: 'Backgrounds', items: BACKGROUNDS, capa: 'fondo' },
  { id: 'banderas',    titulo: 'Banderas',    items: BANDERAS,    capa: 'grafico' },
  { id: 'miscelaneos', titulo: 'Misceláneos', items: MISCELANEOS, capa: 'grafico' },
  { id: 'pilotos',     titulo: 'Pilotos',     items: PILOTOS,     capa: 'grafico' },
]

// ─── Indicador de una capa en la barra de estado ──────────────
function Capa({ etiqueta, item }) {
  return (
    <div className="min-w-0">
      <p className="text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
        {etiqueta}
      </p>
      {item ? (
        <p className="flex items-center gap-2 text-base font-black italic text-white min-w-0"
           title={item.nombre}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot} animate-pulse`} />
          <span className="truncate">{item.nombre.toUpperCase()}</span>
        </p>
      ) : (
        <p className="text-base font-black italic text-neutral-600">—</p>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────
// `pilotosRegistrados` llegará del backend
export default function GraficosModule({ pilotosRegistrados = [] }) {
  // Dos capas independientes: el fondo permanece al aire mientras
  // se cambia el gráfico que va encima.
  const [activeBg,  setActiveBg]  = useState(null)
  const [activeGfx, setActiveGfx] = useState(null)
  const [activeTab, setActiveTab] = useState('backgrounds')

  // Formulario de datos: qué botón lo tiene abierto y sus valores.
  const [formAbierto, setFormAbierto] = useState(null)
  const [narrador,    setNarrador]    = useState({ nombre: '', equipo: '' })
  const [pilotoId,    setPilotoId]    = useState(null)

  const bgItem  = BACKGROUNDS.find(item => item.id === activeBg)  || null
  const gfxItem = GRAFICOS.find(item => item.id === activeGfx)    || null
  const hayAlgoAlAire = Boolean(bgItem || gfxItem)

  // Dentro de cada capa la selección es única; volver a pulsar la saca.
  const toggleBg  = (id) => setActiveBg(prev  => (prev === id ? null : id))
  const toggleGfx = (id) => setActiveGfx(prev => (prev === id ? null : id))

  const sacarTodo = () => { setActiveBg(null); setActiveGfx(null); setFormAbierto(null) }

  // Los gráficos con datos abren su formulario; el resto sale al aire directo.
  const alPulsarItem = (item, capa) => {
    // Un botón con formulario abre el suyo, o lo cierra si ya estaba abierto.
    if (REQUIERE_DATOS[item.id]) {
      return setFormAbierto(prev => (prev === item.id ? null : item.id))
    }
    // Cualquier otro botón cierra el formulario que estuviera abierto.
    setFormAbierto(null)
    if (capa === 'fondo') return toggleBg(item.id)
    toggleGfx(item.id)
  }

  const itemDelForm = formAbierto ? GRAFICOS.find(i => i.id === formAbierto) : null

  const tabActual = TABS.find(t => t.id === activeTab) || TABS[0]

  // Qué elemento de una pestaña está al aire, para marcarlo aunque no esté abierto.
  const alAireEn = (tab) =>
    tab.items.find(item => item.id === activeBg || item.id === activeGfx) || null

  return (
    <div className="w-full space-y-6 animate-fade-in">

      {/* ── Barra de estado: qué está al aire, por capa ── */}
      <div className="bg-[#141414] rounded-xl px-6 py-4 border border-neutral-800 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-red-600/10 rotate-45 transform" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${hayAlgoAlAire ? 'bg-red-600/15 text-red-500' : 'bg-neutral-800 text-neutral-500'}`}>
              <Radio size={20} />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-8 min-w-0 flex-1">
              <Capa etiqueta="Fondo"   item={bgItem} />
              <Capa etiqueta="Gráfico" item={gfxItem} />
            </div>
          </div>

          <button
            onClick={sacarTodo}
            disabled={!hayAlgoAlAire}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10 transition-all font-bold text-sm whitespace-nowrap flex-shrink-0 self-start lg:self-auto disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:text-neutral-300 disabled:hover:bg-transparent"
          >
            <PowerOff size={16} />
            SACAR TODO DE AIRE
          </button>
        </div>
      </div>

      {/* ── Pestañas por categoría ── */}
      <div>
        <div className="flex gap-1 border-b border-neutral-800 overflow-x-auto">
          {TABS.map(tab => {
            const enAire     = alAireEn(tab)
            const esteActivo = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 -mb-px border-b-2 font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-colors ${
                  esteActivo
                    ? 'border-red-600 text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab.titulo}
                {/* Marca la pestaña que tiene algo al aire aunque esté cerrada */}
                {enAire && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${enAire.dot} animate-pulse`} />
                )}
              </button>
            )
          })}
        </div>

        <div className={`${GRID} mt-4`}>
          {tabActual.items.map(item => (
            <GraphicButton
              key={item.id}
              item={item}
              isActive={tabActual.capa === 'fondo' ? activeBg === item.id : activeGfx === item.id}
              isEditing={formAbierto === item.id}
              onClick={() => alPulsarItem(item, tabActual.capa)}
            />
          ))}
        </div>

        {/* El formulario solo aparece si su botón vive en la pestaña abierta */}
        {itemDelForm && tabActual.items.includes(itemDelForm) && (
          <FormularioPersonal
            item={itemDelForm}
            tipo={REQUIERE_DATOS[itemDelForm.id]}
            pilotosRegistrados={pilotosRegistrados}
            narrador={narrador}   setNarrador={setNarrador}
            pilotoId={pilotoId}   setPilotoId={setPilotoId}
            alAire={activeGfx === itemDelForm.id}
            onMostrar={() => setActiveGfx(itemDelForm.id)}
            onOcultar={() => setActiveGfx(null)}
          />
        )}
      </div>
    </div>
  )
}
