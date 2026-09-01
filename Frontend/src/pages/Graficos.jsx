import { useEffect, useState } from 'react'
import SelectorCarrera from '../components/graphics/SelectorCarrera'
import { useCarrera } from '../context/CarreraContext'
import {
  Flag, Siren, CloudSun, Mic, Calendar, Share2, Map,
  SquareUser, Contact, ListOrdered, Crown, ArrowUpDown, LayoutGrid,
  Radio, PowerOff, Search, Eye, EyeOff, Loader2, Eraser, AlertTriangle, X, MessageSquare,
  Users, RefreshCw, Play, Pause, RotateCcw, Timer, Plus, Minus, Check,
  Wrench, Droplets, Ban, Table2, Lock, Repeat,
} from 'lucide-react'
import {
  playGraphic, updateGraphic, clearGroup, clearAll, getState, getPilots, getCategories,
  getClasificacion,
  getLineup, setDriver, getTimer, startTimer, pauseTimer, resetTimer,
  configTimer, lapTimer,
} from '../api/graphics'

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
  { id: 'pista-resbaladiza', label: 'Resbaladiza', nombre: 'Pista Resbaladiza', detalle: 'Aceite o agua en pista',    Icon: Droplets,
    icon: 'text-amber-400',  border: 'border-amber-500',  bgActive: 'bg-amber-500/10',  dot: 'bg-amber-400' },
  { id: 'bandera-azul',     label: 'Azul',       nombre: 'Bandera Azul',       detalle: 'Ceder el paso al líder',      Icon: Flag,
    icon: 'text-blue-500',   border: 'border-blue-500',   bgActive: 'bg-blue-500/10',   dot: 'bg-blue-500' },
  { id: 'bandera-mecanica', label: 'Mecánico',   nombre: 'Problema Mecánico',  detalle: 'El piloto debe entrar a boxes', Icon: Wrench,
    icon: 'text-orange-500', border: 'border-orange-600', bgActive: 'bg-orange-600/10', dot: 'bg-orange-500' },
  { id: 'bandera-negra',    label: 'Negra',      nombre: 'Bandera Negra',      detalle: 'Piloto descalificado',        Icon: Ban,
    icon: 'text-neutral-400', border: 'border-neutral-500', bgActive: 'bg-neutral-500/10', dot: 'bg-neutral-400' },
  { id: 'bandera-roja',     label: 'Roja',       nombre: 'Bandera Roja',       detalle: 'Carrera detenida',            Icon: Flag,
    icon: 'text-red-500',    border: 'border-red-600',    bgActive: 'bg-red-600/10',    dot: 'bg-red-500' },
  { id: 'bandera-blanca',   label: 'Blanca',     nombre: 'Bandera Blanca',     detalle: 'Última vuelta',                Icon: Flag,
    icon: 'text-zinc-100',   border: 'border-zinc-200',   bgActive: 'bg-zinc-100/10',   dot: 'bg-zinc-100' },
  { id: 'bandera-cuadros',  label: 'Cuadros',    nombre: 'Bandera de Cuadros', detalle: 'Fin de carrera',              Icon: CheckeredFlag,
    icon: 'text-white',      border: 'border-white',      bgActive: 'bg-white/10',      dot: 'bg-white' },
]

// ─── Misceláneos ──────────────────────────────────────────────
// Orden pedido: primero lo del evento y la pista, después las personas
// que hablan. Los tres últimos comparten plantilla y formulario; solo
// cambia el rótulo que sale en el arte.
const MISCELANEOS = [
  { id: 'evento',   label: 'Evento',   nombre: 'Evento',         detalle: 'Datos del evento en curso',   Icon: Calendar, ...ROJO },
  { id: 'circuito', label: 'Circuito', nombre: 'Circuito',       detalle: 'Imagen de la pista',          Icon: Map,      ...ROJO },
  { id: 'clima',    label: 'Clima',    nombre: 'Clima',          detalle: 'Condiciones de pista',        Icon: CloudSun, ...ROJO },
  { id: 'redes',    label: 'Redes',    nombre: 'Redes Sociales', detalle: 'Cuentas oficiales',           Icon: Share2,   ...ROJO },
  { id: 'narrador', label: 'Narrador', nombre: 'Narrador',       detalle: 'Identificación del narrador', Icon: Mic,      ...ROJO },
  { id: 'comentarista', label: 'Comentarista', nombre: 'Comentarista',
    detalle: 'Identificación del comentarista', Icon: MessageSquare, ...ROJO },
  { id: 'reportero', label: 'Reportero', nombre: 'Reportero',
    detalle: 'Identificación del reportero', Icon: Radio, ...ROJO },
]

// ─── Tótems: la clasificación en vivo ─────────────────────────
// El cuadro de resultados va en su propia capa (70) porque ocupa la
// pantalla: si compartiera capa con los tótems, sacarlo los tumbaría.
const RESULTADOS = [
  { id: 'resultados', label: 'Cuadro de Resultados', nombre: 'Cuadro de Resultados',
    detalle: 'Tabla completa de la tanda con tiempos', Icon: Table2,
    icon: 'text-violet-400', border: 'border-violet-500', bgActive: 'bg-violet-500/10', dot: 'bg-violet-400' },
]

const TOTEMS = [
  { id: 'totem-completo',  label: 'Tótem Completo',  nombre: 'Tótem Nombre Completo',
    detalle: 'Clasificación con el nombre completo',                  Icon: ListOrdered, ...ROJO },
  { id: 'totem-lider',     label: 'Tótem Líder',     nombre: 'Tótem al Líder',
    detalle: 'Diferencia de cada piloto contra el líder',             Icon: Crown,       ...ROJO },
  { id: 'totem-intervalo', label: 'Tótem Intervalo', nombre: 'Tótem Intervalo',
    detalle: 'Diferencia entre cada piloto y el que va adelante',     Icon: ArrowUpDown, ...ROJO },
]

// ─── Fichas de piloto ─────────────────────────────────────────
const FICHAS = [
  { id: 'ficha-corta',    label: 'Ficha Corta',    nombre: 'Ficha Corta',
    detalle: 'Datos básicos del piloto',                              Icon: SquareUser,  ...ROJO },
]

// ─── Grilla de partida ────────────────────────────────────────
const GRILLAS = [
  { id: 'grilla',       label: 'Grilla',      nombre: 'Grilla de Partida',
    detalle: 'Posiciones de largada, de dos en dos',                  Icon: LayoutGrid,  ...ROJO },
  { id: 'grilla-fotos', label: 'Con Fotos',   nombre: 'Grilla con Fotos',
    detalle: 'Posiciones de largada con la foto de cada piloto',      Icon: Contact,     ...ROJO },
]

// Catálogo plano, para resolver un botón por su id.
const GRAFICOS = [...BACKGROUNDS, ...BANDERAS, ...MISCELANEOS, ...TOTEMS, ...FICHAS, ...GRILLAS]

// Misma grilla en las tres secciones para que las columnas queden alineadas.
const GRID = 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3'

// ─── Botón de gráfico ─────────────────────────────────────────
function GraphicButton({ item, isActive, isEditing, isPending, bloqueado, onClick }) {
  const { Icon, label, detalle } = item
  return (
    <button
      type="button"
      onClick={onClick}
      // Mientras un comando viaja al servidor no se aceptan más pulsaciones:
      // evita mandar dos ADD seguidos a la misma capa.
      disabled={bloqueado}
      title={detalle}
      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 disabled:cursor-not-allowed ${
        isActive
          ? `${item.border} ${item.bgActive} text-white`
          : isEditing
            ? 'border-neutral-500 bg-neutral-900 text-white'
            : 'border-neutral-800 bg-[#0a0a0a] text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900'
      } ${bloqueado && !isPending ? 'opacity-40' : ''}`}
    >
      {isPending
        ? <Loader2 size={20} className={`flex-shrink-0 animate-spin ${item.icon}`} />
        : <Icon size={20} className={`flex-shrink-0 ${item.icon}`} />}
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
  'comentarista':   'narrador',  // mismo formulario, misma plantilla base
  'reportero':      'narrador',  // idem; cambia el rótulo del arte
  'ficha-corta':    'piloto',    // sale del registro de pilotos
}

// ─── Formulario en línea ──────────────────────────────────────
function FormularioPersonal({
  item, tipo, pilotosRegistrados, categorias,
  narrador, setNarrador, pilotoId, setPilotoId,
  categoriaFicha, setCategoriaFicha,
  alAire, ocupado, onMostrar, onOcultar,
}) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState(null)   // null = todas

  // Solo se ofrecen las categorías que tienen pilotos cargados: no sirve
  // de nada un filtro que deja la lista vacía.
  const categoriasConPilotos = categorias.filter(c =>
    pilotosRegistrados.some(p => p.categorias.includes(c.id))
  )

  const porCategoria = categoria === null
    ? pilotosRegistrados
    : pilotosRegistrados.filter(p => p.categorias.includes(categoria))

  const filtrados = porCategoria.filter(p =>
    `${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )
  const pilotoElegido = pilotosRegistrados.find(p => p.id === pilotoId) || null

  // Con el piloto elegido pero sin categoría, la ficha saldría con un
  // vehículo cualquiera de los suyos. Mejor no dejar sacarla.
  const faltaCategoria =
    pilotoElegido !== null &&
    pilotoElegido.categorias.length > 1 &&
    categoriaFicha === null

  const listo = tipo === 'narrador'
    ? narrador.nombre.trim() !== ''
    : pilotoId !== null && !faltaCategoria

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
            <>
              <div className="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-red-600/40 rounded p-2">
                <span className="text-white font-semibold text-sm truncate">
                  {pilotoElegido.nombre} <span className="uppercase">{pilotoElegido.apellido}</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setPilotoId(null); setCategoriaFicha(null); setBusqueda('') }}
                  className="text-neutral-400 hover:text-white text-xs font-bold flex-shrink-0"
                >
                  CAMBIAR
                </button>
              </div>

              {/* Un piloto que corre en varias categorías tiene un carro en
                  cada una, y con él otra subcategoría. Sin preguntar, la
                  ficha salía con el primer vehículo que devolviera la base,
                  que no tiene por qué ser el de la carrera en curso. Con una
                  sola categoría no se pregunta: ya quedó fijada al elegirlo. */}
              {pilotoElegido.categorias.length > 1 && (
                <div className="mt-3">
                  <label className="block text-neutral-400 text-xs mb-2 uppercase">
                    Corre en {pilotoElegido.categorias.length} categorías · elige cuál mostrar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {pilotoElegido.categorias.map(cid => {
                      const cat = categorias.find(c => c.id === cid)
                      const activa = categoriaFicha === cid
                      return (
                        <button
                          key={cid} type="button"
                          onClick={() => setCategoriaFicha(cid)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                            activa
                              ? 'border-red-600 bg-red-600/15 text-red-400'
                              : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                          }`}
                        >
                          {cat ? cat.nombre : `#${cid}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Primero la categoría: acota la lista antes de buscar */}
              {categoriasConPilotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {[{ id: null, nombre: 'Todas' }, ...categoriasConPilotos].map(c => {
                    const activa = categoria === c.id
                    const cuantos = c.id === null
                      ? pilotosRegistrados.length
                      : pilotosRegistrados.filter(p => p.categorias.includes(c.id)).length
                    return (
                      <button
                        key={c.id ?? 'todas'} type="button"
                        onClick={() => { setCategoria(c.id); setBusqueda('') }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                          activa
                            ? 'border-red-600 bg-red-600/15 text-white'
                            : 'border-neutral-800 bg-[#0a0a0a] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                        }`}
                      >
                        {c.nombre}
                        <span className={activa ? 'text-red-400' : 'text-neutral-600'}>
                          {cuantos}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

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
                      onClick={() => {
                        setPilotoId(p.id)
                        // Con una sola categoría no hay nada que preguntar:
                        // se fija y el formulario queda listo de una vez.
                        setCategoriaFicha(p.categorias.length === 1 ? p.categorias[0] : null)
                      }}
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
          type="button" onClick={onOcultar} disabled={!alAire || ocupado}
          className="flex items-center gap-2 px-5 py-2 rounded border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10 transition-all font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:text-neutral-300 disabled:hover:bg-transparent"
        >
          <EyeOff size={16} />
          OCULTAR
        </button>
        <button
          type="button" onClick={onMostrar} disabled={!listo || ocupado}
          className="flex items-center gap-2 bg-white text-black font-bold py-2 px-6 rounded hover:bg-neutral-200 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye size={16} />
          {alAire ? 'ACTUALIZAR DATOS' : 'MOSTRAR GRÁFICO'}
        </button>
      </div>
    </div>
  )
}

// ─── Secciones ────────────────────────────────────────────────
// Cada sección es una capa de CasparCG y son todas independientes:
// pueden estar las seis al aire a la vez, y cada una se limpia sola.
// El orden de arriba a abajo es el de apilado: la 10 va detrás de todo
// y la 60 delante. `grupo` es el nombre que entiende el backend.
const SECCIONES = {
  fondos:      { titulo: 'Fondos',          grupo: 'background', capa: 10, items: BACKGROUNDS },
  totems:      { titulo: 'Tótems',          grupo: 'totem',      capa: 20, items: TOTEMS },
  banderas:    { titulo: 'Banderas',        grupo: 'flag',       capa: 30, items: BANDERAS },
  grilla:      { titulo: 'Grilla',          grupo: 'grid',       capa: 40, items: GRILLAS },
  fichas:      { titulo: 'Fichas',          grupo: 'pilot',      capa: 50, items: FICHAS },
  miscelaneos: { titulo: 'Misceláneos',     grupo: 'misc',       capa: 60, items: MISCELANEOS },
  resultados:  { titulo: 'Resultados',      grupo: 'results',    capa: 70, items: RESULTADOS },
}

// ─── Control de la tanda ───────────────────────────────
// MyLaps dice cuánto dura la tanda pero no la arranca. El control lo
// lleva el backend, así los cuatro tótems muestran lo mismo; aquí solo
// se manda y se refleja lo que responde.
//
// Dos modos: cuenta atrás desde un tiempo escrito a mano, o contador de
// vueltas que sube conforme avanza la carrera.
function RelojTanda({ reloj, ocupado, pendiente, onConfig, onArrancar,
                      onPausar, onReiniciar, onVuelta }) {

  const modo      = reloj?.modo ?? 'tiempo'
  const corriendo = reloj?.estado === 'corriendo'

  // Lo que se está escribiendo, sin mandarlo todavía al backend.
  const [duracion, setDuracion] = useState('')
  const [vueltas,  setVueltas]  = useState('')

  const inputClass = 'w-24 bg-[#0a0a0a] border border-neutral-800 rounded px-2 py-1.5 text-white text-sm text-center tabular-nums focus:border-red-600 focus:outline-none'
  const btnBase = 'flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mt-6">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
          <Timer size={13} />
          Control de la tanda
          <span className="text-neutral-600 normal-case">
            {corriendo ? 'en marcha'
              : reloj?.estado === 'pausado' ? 'en pausa'
              : 'detenida'}
          </span>
        </h3>

        {/* Cambiar de modo con la tanda en marcha confundiría al operador */}
        <div className="flex gap-1 bg-[#0a0a0a] border border-neutral-800 rounded-lg p-1">
          {[['tiempo', 'Tiempo'], ['vueltas', 'Vueltas']].map(([id, texto]) => (
            <button
              key={id} type="button"
              onClick={() => onConfig({ modo: id })}
              disabled={ocupado || corriendo}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                modo === id ? 'bg-red-600/20 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">

        <span className={`font-black italic tabular-nums text-4xl leading-none ${
          corriendo ? 'text-white'
            : reloj?.terminado ? 'text-red-500'
            : 'text-neutral-400'
        }`}>
          {reloj?.texto ?? '--:--'}
        </span>

        {modo === 'tiempo' ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="text" value={duracion} placeholder={reloj?.duracion_texto || 'mm:ss'}
                onChange={e => setDuracion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && duracion.trim()) {
                  onConfig({ duracion: duracion.trim() }); setDuracion('')
                } }}
                disabled={ocupado || corriendo}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => { onConfig({ duracion: duracion.trim() }); setDuracion('') }}
                disabled={ocupado || corriendo || !duracion.trim()}
                className={`${btnBase} border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400`}
              >
                <Check size={15} />
                FIJAR
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button" onClick={corriendo ? onPausar : onArrancar} disabled={ocupado}
                className={`${btnBase} ${corriendo
                  ? 'border-yellow-500 text-yellow-400 hover:bg-yellow-500/10'
                  : 'border-green-500 text-green-400 hover:bg-green-500/10'}`}
              >
                {pendiente === 'reloj'
                  ? <Loader2 size={15} className="animate-spin" />
                  : corriendo ? <Pause size={15} /> : <Play size={15} />}
                {corriendo ? 'PAUSAR' : 'INICIAR'}
              </button>

              <button
                type="button" onClick={onReiniciar} disabled={ocupado}
                className={`${btnBase} border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10`}
              >
                <RotateCcw size={15} />
                REINICIAR
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" value={vueltas}
                placeholder={reloj?.vueltas_total || 'total'}
                onChange={e => setVueltas(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && vueltas !== '') {
                  onConfig({ vueltas_total: Number(vueltas) }); setVueltas('')
                } }}
                disabled={ocupado}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => { onConfig({ vueltas_total: Number(vueltas) }); setVueltas('') }}
                disabled={ocupado || vueltas === ''}
                className={`${btnBase} border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400`}
              >
                <Check size={15} />
                FIJAR
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button" onClick={() => onVuelta(-1)} disabled={ocupado || !reloj?.vuelta}
                className={`${btnBase} border-neutral-700 text-neutral-300 hover:border-neutral-500`}
              >
                <Minus size={15} />
              </button>

              <button
                type="button" onClick={() => onVuelta(1)} disabled={ocupado}
                className={`${btnBase} border-green-500 text-green-400 hover:bg-green-500/10`}
              >
                <Plus size={15} />
                VUELTA
              </button>

              <button
                type="button" onClick={onReiniciar} disabled={ocupado}
                className={`${btnBase} border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10`}
              >
                <RotateCcw size={15} />
                REINICIAR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Quién va manejando ───────────────────────────────────────
// MyLaps no distingue cuál de los dos pilotos de un carro compartido
// está en pista: manda los dos nombres pegados en el mismo campo. Este
// panel deja elegirlo, y el tótem respeta la elección.
function PilotosEnPista({ carros, cargando, error, ocupado, onElegir, onRecargar }) {

  // Solo interesan los carros que exigen una decisión.
  const compartidos = carros.filter(c => c.pilots.length > 1)
  const sinRegistrar = carros.filter(c => !c.en_base)

  return (
    <div className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mt-6">

      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="flex items-center gap-2 text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
          <Users size={13} />
          Quién va manejando
          {carros.length > 0 && (
            <span className="text-neutral-600 normal-case">
              {carros.length} carros en pista
            </span>
          )}
        </h3>

        <button
          type="button" onClick={onRecargar} disabled={cargando}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10 transition-all font-bold text-[11px] uppercase tracking-wider disabled:opacity-30"
        >
          {cargando
            ? <Loader2 size={13} className="animate-spin" />
            : <RefreshCw size={13} />}
          Recargar
        </button>
      </div>

      {error ? (
        <p className="text-neutral-500 text-sm">{error}</p>
      ) : compartidos.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          {carros.length === 0
            ? 'Sin datos de cronometraje todavía.'
            : 'Ningún carro de esta tanda lleva dos pilotos.'}
        </p>
      ) : (
        <div className="space-y-2">
          {compartidos.map(carro => (
            <div key={carro.vehicle_id}
                 className="flex flex-wrap items-center gap-3 bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2">

              <span className="font-black italic text-white text-lg w-14 flex-shrink-0">
                #{carro.number}
              </span>

              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                {carro.pilots.map(p => {
                  const activo = carro.active_pilot_id === p.pilot_id
                  return (
                    <button
                      key={p.pilot_id} type="button"
                      onClick={() => onElegir(carro.vehicle_id, p.pilot_id)}
                      disabled={ocupado}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                        activo
                          ? 'border-red-600 bg-red-600/15 text-white'
                          : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                      }`}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {sinRegistrar.length > 0 && (
        <p className="text-neutral-600 text-xs mt-3">
          Sin registrar en la base: {sinRegistrar.map(c => '#' + c.number).join(', ')}
          {' '}— saldrán con el nombre que manda MyLaps.
        </p>
      )}
    </div>
  )
}

// ─── Pestañas ─────────────────────────────────────────────────
// General junta lo que se opera igual: se pulsa y sale al aire.
// Pilotos y Grilla van aparte porque piden datos antes de graficar.
// Sin carrera elegida estas pestañas quedan cerradas: las fichas salen de
// los pilotos inscritos, la grilla de los vehículos del evento y el cuadro
// de resultados lleva el nombre de la tanda. General no depende de nada.
const TABS_QUE_NECESITAN_CARRERA = ['carrera', 'pilotos', 'grilla']

const TABS = [
  {
    id: 'general',
    titulo: 'General',
    secciones: [
      SECCIONES.fondos,
      SECCIONES.miscelaneos,
    ],
  },
  {
    // Lo que se opera durante la tanda: primero la bandera, debajo el tótem.
    id: 'carrera',
    titulo: 'Carrera',
    secciones: [
      SECCIONES.banderas,
      SECCIONES.totems,
      SECCIONES.resultados,
    ],
  },
  { id: 'pilotos', titulo: 'Pilotos', secciones: [SECCIONES.fichas] },
  { id: 'grilla',  titulo: 'Grilla',  secciones: [SECCIONES.grilla] },
]

// Todos los botones de una pestaña, sin importar en qué sección estén.
const itemsDe = (tab) => tab.secciones.flatMap(s => s.items)

// A qué grupo pertenece cada botón, para saber qué capa toca.
const GRUPO_DE = Object.fromEntries(
  Object.values(SECCIONES).flatMap(s => s.items.map(i => [i.id, s.grupo])),
)

// Orden de apilado, para listar lo que hay al aire de atrás hacia adelante.
const GRUPOS = Object.values(SECCIONES).sort((a, b) => a.capa - b.capa)

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
export default function GraficosModule() {
  // Una entrada por capa: { background, totem, flag, grid, pilot, misc }.
  // Las seis conviven al aire; tocar una no afecta a las demás.
  const [alAire,    setAlAire]    = useState({})

  // Vuelta rápida: si el desplegable está abierto y quién la tiene. El
  // piloto se consulta al cronometraje porque la franja solo puede
  // abrirse bajo su fila, y a veces no está entre los que se ven.
  const [mejorVuelta,   setMejorVuelta]   = useState(false)
  const [rapido,        setRapido]        = useState(null)
  const { carrera, omitida, hayCarrera, limpiar } = useCarrera()

  const [activeTab, setActiveTab] = useState('general')

  // Formulario de datos: qué botón lo tiene abierto y sus valores.
  const [formAbierto, setFormAbierto] = useState(null)
  const [narrador,    setNarrador]    = useState({ nombre: '', equipo: '' })
  const [pilotoId,    setPilotoId]    = useState(null)

  // Desde qué categoría se grafica al piloto. Solo se pregunta cuando
  // corre en más de una: Dean Paquette está en Prospec Series y en GT
  // Challenge con carros distintos, y la ficha tiene que decir cuál.
  const [categoriaFicha, setCategoriaFicha] = useState(null)

  // Qué comando está viajando al servidor y el último error que devolvió.
  const [pendiente, setPendiente] = useState(null)
  const [error,     setError]     = useState(null)

  // Registro: pilotos y categorías, para los gráficos que salen de la base.
  const [pilotosRegistrados, setPilotos]  = useState([])
  const [categorias,         setCategorias] = useState([])

  // Carros de la tanda actual, para elegir quién va manejando.
  const [carros,        setCarros]        = useState([])
  const [reloj,         setReloj]         = useState(null)
  const [cargandoPista, setCargandoPista] = useState(false)
  const [errorPista,    setErrorPista]    = useState(null)

  // Está activo si su capa lo tiene al aire.
  const estaAlAire = (item) => alAire[GRUPO_DE[item.id]] === item.id
  const hayAlgoAlAire = Object.values(alAire).some(Boolean)
  const ocupado = pendiente !== null

  // Al montar, pregunta al backend qué quedó al aire. Si CasparCG ya
  // estaba graficando (o se recargó la página) los botones aparecen
  // encendidos en vez de mentir diciendo que no hay nada.
  // El backend ya devuelve on_air indexado por grupo, así que entra tal cual.
  useEffect(() => {
    getState()
      .then(estado => setAlAire(estado?.on_air || {}))
      .catch(() => {})  // sin backend se arranca en blanco, sin molestar
  }, [])

  // Los pilotos vienen del registro: el botón solo manda el pilot_id y el
  // backend arma los datos que recibirá la plantilla.
  useEffect(() => {
    getPilots()
      .then(lista => setPilotos(lista.map(p => ({
        id: p.pilot_id, nombre: p.name, apellido: p.last_name,
        categorias: p.categories || [],
      }))))
      .catch(() => {})

    getCategories()
      .then(lista => setCategorias(lista.map(c => ({
        id: c.category_id, nombre: c.category_name,
      }))))
      .catch(() => {})
  }, [])

  // Se refresca sola: la vuelta rápida cambia durante la tanda y el botón
  // tiene que saber si el que la tiene sigue estando a la vista.
  useEffect(() => {
    let vivo = true

    const mirar = () =>
      getClasificacion(20)
        .then(d => {
          if (!vivo) return
          const fila = (d.standings || []).find(p => p.is_best_lap)
          setRapido(fila
            ? { nombre: `${fila.name} ${fila.last_name}`.trim(), tiempo: fila.best_time }
            : null)
        })
        .catch(() => { if (vivo) setRapido(null) })

    mirar()
    const id = setInterval(mirar, 8000)
    return () => { vivo = false; clearInterval(id) }
  }, [])

  const recargarPista = () => {
    setCargandoPista(true)
    setErrorPista(null)
    return getLineup()
      .then(d => setCarros(d.carros || []))
      .catch(e => setErrorPista(e.message))
      .finally(() => setCargandoPista(false))
  }

  // Se recarga al entrar a la pestaña de Carrera: entre tanda y tanda
  // cambian los carros en pista.
  useEffect(() => {
    if (activeTab === 'carrera') recargarPista()
  }, [activeTab])

  // El reloj lo lleva el backend; aquí solo se refresca para verlo bajar.
  // Solo mientras la pestaña está abierta: fuera de ella no hace falta.
  useEffect(() => {
    if (activeTab !== 'carrera') return

    let vivo = true
    const tic = () => {
      getTimer()
        .then(r => { if (vivo) setReloj(r) })
        .catch(() => {})
    }
    tic()
    const id = setInterval(tic, 500)
    return () => { vivo = false; clearInterval(id) }
  }, [activeTab])

  // Cada acción refresca el reloj con lo que devuelva el backend, que es
  // la única fuente de verdad.
  const mandarReloj = (accion) =>
    ejecutar('reloj', async () => { setReloj(await accion()) }, () => {})

  const elegirPiloto = (vehicleId, pilotId) =>
    ejecutar(`piloto-${vehicleId}`,
      () => setDriver(vehicleId, pilotId),
      () => setCarros(prev => prev.map(c =>
        c.vehicle_id === vehicleId ? { ...c, active_pilot_id: pilotId } : c)))

  // Manda el comando y espera la confirmación antes de tocar el estado:
  // si CasparCG falla, el botón no se queda marcado como activo.
  const ejecutar = async (id, accion, alConfirmar) => {
    setPendiente(id)
    setError(null)
    try {
      await accion()
      alConfirmar()
    } catch (e) {
      setError(e.message)
    } finally {
      setPendiente(null)
    }
  }

  const marcar = (grupo, id) => setAlAire(prev => ({ ...prev, [grupo]: id }))

  // Saca un gráfico al aire, o lo quita si ya estaba.
  //
  // No hace falta limpiar antes de cambiar dentro de la misma capa: un
  // CG ADD sobre una capa ocupada reemplaza lo que hubiera. Y como cada
  // grupo tiene su propia capa, tocar una nunca afecta a las otras.
  const alternar = (id, extra) => {
    const grupo = GRUPO_DE[id]

    if (alAire[grupo] === id) {
      return ejecutar(id, () => clearGroup(grupo), () => marcar(grupo, null))
    }
    return ejecutar(id, () => playGraphic(id, extra), () => marcar(grupo, id))
  }

  // Limpia solo esa capa: CLEAR 1-<capa>. Las demás siguen al aire.
  const limpiarGrupo = (grupo) =>
    ejecutar(`limpiar-${grupo}`, () => clearGroup(grupo), () => marcar(grupo, null))

  // Los gráficos con formulario mandan sus datos al sacarlos al aire.
  const datosDelForm = (item) => {
    const tipo = REQUIERE_DATOS[item.id]
    if (tipo === 'piloto') return { pilotId: pilotoId, categoryId: categoriaFicha }
    if (tipo === 'narrador') {
      return { data: { name: narrador.nombre, text: narrador.equipo } }
    }
    return undefined
  }

  // Abre o cierra la franja de la vuelta rápida en el tótem que esté al
  // aire. Va por UPDATE y no por PLAY: el gráfico ya está puesto y solo
  // se le cambia un dato, sin volver a montarlo.
  const alternarMejorVuelta = () => {
    const totem = alAire.totem
    if (!totem) return

    const abrir = !mejorVuelta

    ejecutar('mejor-vuelta',
      () => updateGraphic(totem, { data: { mejor_vuelta: abrir } }),
      () => setMejorVuelta(abrir))
  }

  // Sacar un tótem de aire lo deja cerrado; si no, al volver a ponerlo el
  // botón diría "abierta" y la franja estaría cerrada.
  useEffect(() => {
    if (!alAire.totem) setMejorVuelta(false)
  }, [alAire.totem])

  // CLEAR del canal entero: vacía las seis capas de una vez.
  const sacarTodo = () =>
    ejecutar('sacar-todo', clearAll, () => {
      setAlAire({})
      setFormAbierto(null)
    })

  // Los gráficos con datos abren su formulario; el resto sale al aire directo.
  const alPulsarItem = (item) => {
    // Un botón con formulario abre el suyo, o lo cierra si ya estaba abierto.
    if (REQUIERE_DATOS[item.id]) {
      return setFormAbierto(prev => (prev === item.id ? null : item.id))
    }
    // Cualquier otro botón cierra el formulario que estuviera abierto.
    setFormAbierto(null)

    // El gráfico de evento saca su texto del evento elegido arriba, no de
    // un valor escrito en la plantilla: si se cambia de carrera, el arte
    // tiene que cambiar con ella.
    if (item.id === 'evento' && carrera) {
      // El nombre y, si el evento tiene una, su imagen. Las fechas se
      // quedan en la cabecera del panel, que es donde hacen falta para no
      // confundir dos ediciones; en el aire sobran y ensucian el arte.
      //
      // La imagen se manda siempre, vacía incluida: si se omitiera, al
      // cambiar a un evento sin logo se quedaría el del anterior.
      // Se manda el id y lo demás lo resuelve el backend. La imagen no se
      // puede armar aquí: CasparCG abre la plantilla desde file:// y
      // necesita una URL absoluta, que solo el servidor conoce.
      alternar(item.id, { eventId: carrera.event_id })
      return
    }

    alternar(item.id)
  }

  const itemDelForm = formAbierto ? GRAFICOS.find(i => i.id === formAbierto) : null

  const tabActual = TABS.find(t => t.id === activeTab) || TABS[0]

  // Qué elemento de una pestaña está al aire, para marcarlo aunque no esté abierto.
  const alAireEn = (tab) => itemsDe(tab).find(estaAlAire) || null

  // Lo que hay al aire, de la capa de atrás a la de adelante.
  const capasAlAire = GRUPOS
    .map(s => ({ seccion: s, item: s.items.find(i => alAire[s.grupo] === i.id) }))
    .filter(x => x.item)

  // Antes de la botonera se pregunta qué se va a graficar. Si nadie ha
  // elegido ni ha decidido saltárselo, no se muestra nada más.
  if (!carrera && !omitida) {
    return <SelectorCarrera />
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">

      {/* ── Qué carrera se está graficando ── */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-5 py-3 border ${
        hayCarrera ? 'bg-[#141414] border-neutral-800' : 'bg-amber-950/20 border-amber-700/40'
      }`}>
        <div className="min-w-0">
          {hayCarrera ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Graficando</p>
              {/* Con las fechas se distingue un evento de otro del mismo
                  nombre: dos Prospec Series del mismo año, o el del año
                  pasado. Solo el nombre no basta. */}
              <p className="text-sm font-bold text-white truncate">
                {carrera.nombre}
                <span className="text-neutral-500 font-normal">
                  {' — '}{carrera.start_date} — {carrera.end_date}
                </span>
                {carrera.sesion && (
                  <span className="text-red-400"> · {carrera.sesion.nombre}</span>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wider text-amber-500">Sin carrera seleccionada</p>
              <p className="text-sm text-amber-200/80">
                Solo está disponible la pestaña General.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => { limpiar(); setActiveTab('general') }}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 transition-colors text-xs font-bold whitespace-nowrap flex-shrink-0"
        >
          <Repeat size={14}/> {hayCarrera ? 'CAMBIAR CARRERA' : 'ELEGIR CARRERA'}
        </button>
      </div>

      {/* ── Barra de estado: qué está al aire, por capa ── */}
      <div className="bg-[#141414] rounded-xl px-6 py-4 border border-neutral-800 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-red-600/10 rotate-45 transform" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${hayAlgoAlAire ? 'bg-red-600/15 text-red-500' : 'bg-neutral-800 text-neutral-500'}`}>
              <Radio size={20} />
            </div>
            {/* Una entrada por capa ocupada, de la de atrás a la de adelante */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 min-w-0 flex-1">
              {capasAlAire.length === 0 ? (
                <p className="text-base font-black italic text-neutral-600">
                  NADA AL AIRE
                </p>
              ) : (
                capasAlAire.map(({ seccion, item }) => (
                  <Capa key={seccion.grupo}
                        etiqueta={`${seccion.titulo} · 1-${seccion.capa}`}
                        item={item} />
                ))
              )}
            </div>
          </div>

          <button
            onClick={sacarTodo}
            disabled={!hayAlgoAlAire || ocupado}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10 transition-all font-bold text-sm whitespace-nowrap flex-shrink-0 self-start lg:self-auto disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:text-neutral-300 disabled:hover:bg-transparent"
          >
            {pendiente === 'sacar-todo'
              ? <Loader2 size={16} className="animate-spin" />
              : <PowerOff size={16} />}
            SACAR TODO DE AIRE
          </button>
        </div>
      </div>

      {/* ── Lo que respondió el servidor cuando algo sale mal ── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-600/40 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm flex-1 min-w-0 break-words">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white flex-shrink-0"
            aria-label="Cerrar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Pestañas por categoría ── */}
      <div>
        <div className="flex gap-1 border-b border-neutral-800 overflow-x-auto">
          {TABS.map(tab => {
            const enAire     = alAireEn(tab)
            const esteActivo = activeTab === tab.id
            const bloqueada  = !hayCarrera && TABS_QUE_NECESITAN_CARRERA.includes(tab.id)
            return (
              <button
                key={tab.id}
                onClick={() => !bloqueada && setActiveTab(tab.id)}
                disabled={bloqueada}
                title={bloqueada ? 'Elige una carrera para usar esta pestaña' : undefined}
                className={`flex items-center gap-2 px-4 py-3 -mb-px border-b-2 font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-colors ${
                  bloqueada
                    ? 'border-transparent text-neutral-700 cursor-not-allowed'
                    : esteActivo
                      ? 'border-red-600 text-white'
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {bloqueada && <Lock size={11} />}
                {tab.titulo}
                {/* Marca la pestaña que tiene algo al aire aunque esté cerrada */}
                {enAire && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${enAire.dot} animate-pulse`} />
                )}
              </button>
            )
          })}
        </div>

        {/* Una sección por capa, cada una con su propio botón de limpiar */}
        {tabActual.secciones.map((seccion, i) => {
          const ocupadaPor = alAire[seccion.grupo] || null
          return (
            <div key={seccion.grupo} className={i === 0 ? 'mt-4' : 'mt-6'}>

              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="flex items-center gap-2 text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
                  {seccion.titulo}
                  <span className="text-neutral-600 font-mono normal-case">
                    1-{seccion.capa}
                  </span>
                </h3>

                {/* CLEAR 1-<capa>: saca de aire solo esta capa */}
                <button
                  type="button"
                  onClick={() => limpiarGrupo(seccion.grupo)}
                  disabled={!ocupadaPor || ocupado}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 hover:bg-red-600/10 transition-all font-bold text-[11px] uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:text-neutral-300 disabled:hover:bg-transparent"
                >
                  {pendiente === `limpiar-${seccion.grupo}`
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Eraser size={13} />}
                  Limpiar
                </button>
              </div>

              {/* Vuelta rápida: solo en Tótems, que es donde se abre. La
                  franja se despliega bajo la fila de quien la tiene, así
                  que sin ese piloto a la vista no hay dónde ponerla y el
                  botón se explica en vez de quedarse muerto. */}
              {seccion.grupo === 'totem' && (
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <button
                    type="button"
                    onClick={alternarMejorVuelta}
                    disabled={!alAire.totem || !rapido || ocupado}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-[11px] uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      mejorVuelta
                        ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                        : 'border-neutral-700 text-neutral-300 hover:border-purple-500 hover:text-purple-300'
                    }`}
                  >
                    {pendiente === 'mejor-vuelta'
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Timer size={13} />}
                    {mejorVuelta ? 'Ocultar mejor vuelta' : 'Mejor vuelta'}
                  </button>

                  <span className="text-[11px] text-neutral-500">
                    {!alAire.totem
                      ? 'Saca un tótem al aire para poder abrirla.'
                      : !rapido
                        ? 'Quien tiene la vuelta rápida no está entre los que se ven.'
                        : <>
                            <span className="text-purple-400 font-bold">{rapido.tiempo}</span>
                            {' · '}
                            <span className="uppercase">{rapido.nombre}</span>
                          </>}
                  </span>
                </div>
              )}

              <div className={GRID}>
                {seccion.items.map(item => (
                  <GraphicButton
                    key={item.id}
                    item={item}
                    isActive={estaAlAire(item)}
                    isEditing={formAbierto === item.id}
                    isPending={pendiente === item.id}
                    bloqueado={ocupado}
                    onClick={() => alPulsarItem(item)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Control de la tanda: solo en Carrera */}
        {tabActual.id === 'carrera' && (
          <RelojTanda
            reloj={reloj}
            ocupado={ocupado}
            pendiente={pendiente}
            onConfig={(cfg) => mandarReloj(() => configTimer(cfg))}
            onArrancar={() => mandarReloj(startTimer)}
            onPausar={() => mandarReloj(pauseTimer)}
            onReiniciar={() => mandarReloj(resetTimer)}
            onVuelta={(delta) => mandarReloj(() => lapTimer({ delta }))}
          />
        )}

        {/* Elegir piloto en los carros compartidos: solo en Carrera */}
        {tabActual.id === 'carrera' && (
          <PilotosEnPista
            carros={carros}
            cargando={cargandoPista}
            error={errorPista}
            ocupado={ocupado}
            onElegir={elegirPiloto}
            onRecargar={recargarPista}
          />
        )}

        {/* El formulario solo aparece si su botón vive en la pestaña abierta */}
        {itemDelForm && itemsDe(tabActual).includes(itemDelForm) && (
          <FormularioPersonal
            item={itemDelForm}
            tipo={REQUIERE_DATOS[itemDelForm.id]}
            pilotosRegistrados={pilotosRegistrados}
            categorias={categorias}
            narrador={narrador}   setNarrador={setNarrador}
            pilotoId={pilotoId}   setPilotoId={setPilotoId}
            categoriaFicha={categoriaFicha} setCategoriaFicha={setCategoriaFicha}
            alAire={estaAlAire(itemDelForm)}
            ocupado={ocupado}
            onMostrar={() => {
              // Si ya está al aire, refresca los datos sin recargarlo.
              if (estaAlAire(itemDelForm)) {
                return ejecutar(itemDelForm.id,
                  () => updateGraphic(itemDelForm.id, datosDelForm(itemDelForm)),
                  () => {})
              }
              return alternar(itemDelForm.id, datosDelForm(itemDelForm))
            }}
            onOcultar={() => alternar(itemDelForm.id)}
          />
        )}
      </div>
    </div>
  )
}
