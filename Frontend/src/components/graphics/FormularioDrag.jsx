import { useState } from 'react'
import { Eye, EyeOff, Flag, Loader2 } from 'lucide-react'
import { t } from '../../i18n'

/* ==========================================================================
   RESULTADO DE UNA PASADA DE DRAG

   Se escribe a mano. Race America puede exportar los tiempos o no —está por
   confirmar—, y hasta saberlo esto tiene que funcionar solo: en una jornada
   de drag son dos carros por pasada y tres cifras cada uno, así que
   teclearlo es viable aunque nunca llegue la conexión.

   Si mañana el cronometraje exporta, se rellenan estos mismos campos desde
   el backend y el arte no cambia.
========================================================================== */

const CARRIL_VACIO = {
  number: '', name: '', last_name: '',
  brand: '', model: '',
  rt: '', et: '', speed: '',
}

const RONDAS = [
  'Clasificación', 'Octavos de final', 'Cuartos de final',
  'Semifinal', 'Final',
]

const CAMPO =
  'w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 text-sm ' +
  'focus:border-red-600 focus:outline-none text-white'

export default function FormularioDrag({
  item, pilotos, alAire, ocupado, onMostrar, onOcultar,
}) {
  const [ronda, setRonda] = useState(RONDAS[1])
  const [unidad, setUnidad] = useState('km/h')
  const [gana, setGana] = useState(null)          // 0, 1 o ninguno
  const [carriles, setCarriles] = useState([{ ...CARRIL_VACIO }, { ...CARRIL_VACIO }])

  const cambiar = (i, campo, valor) =>
    setCarriles(prev => prev.map((c, n) => (n === i ? { ...c, [campo]: valor } : c)))

  /* Elegir un piloto de la lista rellena su nombre. No se guarda su id: la
     pasada no queda registrada en ningún sitio, es un rótulo para el aire. */
  const elegirPiloto = (i, id) => {
    const p = pilotos.find(x => String(x.id) === String(id))
    if (!p) return
    setCarriles(prev => prev.map((c, n) => (
      n === i ? { ...c, name: p.nombre || '', last_name: p.apellido || '' } : c
    )))
  }

  /* Con los dos tiempos escritos, gana el menor. Se puede corregir a mano
     porque en drag no siempre gana el más rápido: una salida quemada
     descalifica aunque el tiempo sea mejor. */
  const sugerido = (() => {
    const a = parseFloat(carriles[0].et)
    const b = parseFloat(carriles[1].et)
    if (Number.isNaN(a) || Number.isNaN(b)) return null
    return a <= b ? 0 : 1
  })()

  const ganador = gana !== null ? gana : sugerido

  const datos = {
    ronda,
    carriles: carriles.map((c, i) => ({ ...c, unidad, gana: ganador === i })),
  }

  const listo = carriles.some(c => (c.last_name || '').trim() !== '')

  return (
    <div className="bg-[#141414] p-6 rounded-xl border border-red-600/30 mt-4">
      <p className="text-white font-bold text-sm uppercase tracking-wider mb-4">
        {item.nombre}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-neutral-400 text-xs mb-1 uppercase">{t('Ronda')}</label>
          <select value={ronda} onChange={e => setRonda(e.target.value)} className={CAMPO}>
            {RONDAS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-neutral-400 text-xs mb-1 uppercase">
            {t('Unidad de velocidad')}
          </label>
          <select value={unidad} onChange={e => setUnidad(e.target.value)} className={CAMPO}>
            <option value="km/h">km/h</option>
            <option value="mph">mph</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {carriles.map((c, i) => (
          <div
            key={i}
            className={`rounded-lg border p-4 transition-colors ${
              ganador === i ? 'border-green-600/60 bg-green-600/5' : 'border-neutral-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-neutral-300 font-bold text-xs uppercase tracking-wider">
                {i === 0 ? t('Carril izquierdo') : t('Carril derecho')}
              </p>
              <button
                type="button"
                onClick={() => setGana(ganador === i ? null : i)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase transition-colors ${
                  ganador === i
                    ? 'border-green-600 bg-green-600/15 text-green-400'
                    : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Flag size={11} /> {t('Gana')}
              </button>
            </div>

            {/* Traer a alguien de la base ahorra teclear el nombre. No es
                obligatorio: en drag corre gente que no está dada de alta. */}
            <select
              value=""
              onChange={e => elegirPiloto(i, e.target.value)}
              className={`${CAMPO} mb-2`}
            >
              <option value="">{t('Traer un piloto de la lista...')}</option>
              {pilotos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.apellido}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                placeholder={t('Dorsal')} value={c.number} className={CAMPO}
                onChange={e => cambiar(i, 'number', e.target.value)}
              />
              <input
                placeholder={t('Nombre')} value={c.name} className={CAMPO}
                onChange={e => cambiar(i, 'name', e.target.value)}
              />
              <input
                placeholder={t('Apellido')} value={c.last_name} className={CAMPO}
                onChange={e => cambiar(i, 'last_name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                placeholder={t('Marca')} value={c.brand} className={CAMPO}
                onChange={e => cambiar(i, 'brand', e.target.value)}
              />
              <input
                placeholder={t('Modelo')} value={c.model} className={CAMPO}
                onChange={e => cambiar(i, 'model', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* La reacción admite signo: negativa es salida quemada, y el
                  arte la pinta en rojo porque significa descalificado. */}
              <input
                placeholder={t('Reacción')} value={c.rt} inputMode="decimal" className={CAMPO}
                onChange={e => cambiar(i, 'rt', e.target.value)}
              />
              <input
                placeholder={t('Tiempo')} value={c.et} inputMode="decimal" className={CAMPO}
                onChange={e => cambiar(i, 'et', e.target.value)}
              />
              <input
                placeholder={t('Velocidad')} value={c.speed} inputMode="decimal" className={CAMPO}
                onChange={e => cambiar(i, 'speed', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {sugerido !== null && gana === null && (
        <p className="text-[11px] text-neutral-600 mt-3">
          Gana el del tiempo menor. Púlsalo a mano si hubo descalificación.
        </p>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button" onClick={onOcultar} disabled={!alAire || ocupado}
          className="flex items-center gap-2 px-5 py-2 rounded border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400 transition-all font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <EyeOff size={16} />
          {t('OCULTAR')}
        </button>
        <button
          type="button" onClick={() => onMostrar(datos)} disabled={!listo || ocupado}
          className="flex items-center gap-2 bg-white text-black font-bold py-2 px-6 rounded hover:bg-neutral-200 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
          {alAire ? t('ACTUALIZAR DATOS') : t('MOSTRAR GRÁFICO')}
        </button>
      </div>
    </div>
  )
}
