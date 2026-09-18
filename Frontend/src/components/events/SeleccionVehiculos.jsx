import { t } from '../../i18n'
import { useMemo, useState } from 'react'
import { Car, Check, CheckSquare, ChevronRight, Layers, Square, User } from 'lucide-react'

const SIN_SUB = '__sin__'

/** Un carro inscrito lo está en una categoría concreta, así que la fila se
 *  identifica por las dos cosas. El mismo auto corre su clase y también la
 *  categoría abierta, y son dos inscripciones distintas. */
const clave = (vehicleId, categoryId) => `${vehicleId}:${categoryId}`

/** Mete a un piloto en un carro de esa categoría. Si el carro ya está
 *  inscrito ahí —dos pilotos que se turnan el mismo auto— se le suma a esa
 *  fila en vez de abrir otra, que el servidor rechazaría por repetida. */
function conPiloto(inscritos, vehicleId, categoryId, pilotId) {
  const existe = inscritos.some(
    i => i.vehicle_id === vehicleId && i.category_id === categoryId)

  if (!existe) {
    return [...inscritos, { vehicle_id: vehicleId, category_id: categoryId, pilot_ids: [pilotId] }]
  }
  return inscritos.map(i =>
    (i.vehicle_id === vehicleId && i.category_id === categoryId &&
      !i.pilot_ids.includes(pilotId))
      ? { ...i, pilot_ids: [...i.pilot_ids, pilotId] }
      : i)
}

/** Lo saca de donde esté en esa categoría. La fila que se queda sin
 *  pilotos desaparece: un carro inscrito sin nadie al volante no corre. */
function sinPiloto(inscritos, categoryId, pilotId) {
  return inscritos
    .map(i => (i.category_id === categoryId && i.pilot_ids.includes(pilotId))
      ? { ...i, pilot_ids: i.pilot_ids.filter(p => p !== pilotId) }
      : i)
    .filter(i => i.pilot_ids.length > 0 || i.category_id !== categoryId)
}

/**
 * Segundo paso del alta de un evento: qué carros corren, categoría por
 * categoría.
 *
 * Dentro de cada categoría los carros van agrupados por subcategoría,
 * porque es la unidad con la que se decide en pista: no se elige "los de
 * Gran Turismo", se elige quiénes corren en Gran Turismo 1, quiénes en el
 * 2, y así. Las categorías sin subcategorías muestran la lista plana.
 *
 * Las categorías abiertas —DragWar— van al revés: las corre toda la
 * disciplina, así que no hay una lista de carros suyos que mostrar. Se
 * eligen los pilotos, y de cada uno con cuál de sus carros entra. Es como
 * se arma ese bracket: primero quién compite y después con qué.
 */
export default function SeleccionVehiculos({ categorias, vehiculos, pilotos = [], inscritos, onCambiar }) {
  const [activa, setActiva] = useState(categorias[0]?.category_id ?? null)

  const categoria = categorias.find(c => c.category_id === activa)
  const esAbierta = !!categoria?.base

  const porCategoria = useMemo(() => {
    const mapa = {}
    for (const c of categorias) {
      // En una abierta entran todos los de la disciplina, que son los que
      // ya vienen cargados en esta pantalla.
      mapa[c.category_id] = c.base
        ? vehiculos
        : vehiculos.filter(v => v.category_id === c.category_id)
    }
    return mapa
  }, [categorias, vehiculos])

  const carros = porCategoria[activa] || []

  // Los carros de cada piloto, para el modo abierto.
  const carrosDe = useMemo(() => {
    const mapa = {}
    for (const v of vehiculos) {
      for (const p of (v.pilots || [])) {
        (mapa[p.pilot_id] = mapa[p.pilot_id] || []).push(v)
      }
    }
    return mapa
  }, [vehiculos])

  // En una categoría abierta compiten personas, no una parrilla fija: la
  // lista son todos los pilotos activos de la disciplina.
  const corredores = useMemo(
    () => pilotos.filter(p => p.is_active !== false),
    [pilotos],
  )

  const seleccionados = useMemo(
    () => new Set(inscritos.map(i => clave(i.vehicle_id, i.category_id))),
    [inscritos],
  )

  // En qué carro está inscrito ese piloto dentro de la categoría abierta.
  const inscripcionDe = (pilotId) => inscritos.find(
    i => i.category_id === activa && (i.pilot_ids || []).includes(pilotId))

  const cuentaDe = (c) => {
    if (c.base) {
      const total = pilotos.filter(p => p.is_active !== false).length
      const puestos = new Set(
        inscritos.filter(i => i.category_id === c.category_id)
          .flatMap(i => i.pilot_ids || [])).size
      return { total, puestos, etiqueta: total === 1 ? t('piloto') : t('pilotos') }
    }
    const lista = porCategoria[c.category_id] || []
    return {
      total: lista.length,
      puestos: lista.filter(v => seleccionados.has(clave(v.vehicle_id, c.category_id))).length,
      etiqueta: lista.length === 1 ? t('carro') : t('carros'),
    }
  }

  // Los grupos salen de las subcategorías declaradas en la categoría, más
  // uno final para los carros que no tienen ninguna asignada. Se recorren
  // las declaradas y no los valores presentes en los carros para que una
  // subcategoría sin inscritos todavía aparezca y se pueda llenar.
  const grupos = useMemo(() => {
    if (!categoria || categoria.base) return []

    const declaradas = (categoria.sub_categories || []).map(s => ({
      id: s.sub_category_id,
      nombre: s.sub_category_name,
      carros: carros.filter(v => v.sub_category_id === s.sub_category_id),
    }))

    const huerfanos = carros.filter(
      v => v.sub_category_id === null || v.sub_category_id === undefined ||
           !(categoria.sub_categories || []).some(s => s.sub_category_id === v.sub_category_id)
    )

    if (huerfanos.length) {
      declaradas.push({
        id: SIN_SUB,
        nombre: declaradas.length ? t('Sin subcategoría') : null,
        carros: huerfanos,
      })
    }

    return declaradas
  }, [categoria, carros])

  const alternarCarro = (v) => {
    if (seleccionados.has(clave(v.vehicle_id, activa))) {
      onCambiar(inscritos.filter(
        i => clave(i.vehicle_id, i.category_id) !== clave(v.vehicle_id, activa)))
      return
    }
    // Al inscribir un carro entran todos sus pilotos: lo normal es que
    // corran todos, y quitar uno es más rápido que agregarlos de a uno.
    onCambiar([...inscritos, {
      vehicle_id: v.vehicle_id,
      category_id: activa,
      pilot_ids: (v.pilots || []).map(p => p.pilot_id),
    }])
  }

  // Marca la lista entera, o la vacía si ya estaba completa. Sirve igual
  // para una subcategoría que para la categoría completa, que es la misma
  // operación sobre distintos conjuntos de carros.
  const alternarLista = (lista) => {
    const claves = lista.map(v => clave(v.vehicle_id, activa))
    const todos = claves.length > 0 && claves.every(k => seleccionados.has(k))

    if (todos) {
      onCambiar(inscritos.filter(
        i => !claves.includes(clave(i.vehicle_id, i.category_id))))
      return
    }

    // Solo se añaden los que faltan: volver a meter uno ya inscrito
    // duplicaría la fila y perdería los pilotos que se hubieran quitado.
    const faltan = lista.filter(v => !seleccionados.has(clave(v.vehicle_id, activa)))
    onCambiar([...inscritos, ...faltan.map(v => ({
      vehicle_id: v.vehicle_id,
      category_id: activa,
      pilot_ids: (v.pilots || []).map(p => p.pilot_id),
    }))])
  }

  const alternarPilotoAbierta = (pilot) => {
    if (inscripcionDe(pilot.pilot_id)) {
      onCambiar(sinPiloto(inscritos, activa, pilot.pilot_id))
      return
    }
    const suyos = carrosDe[pilot.pilot_id] || []
    if (!suyos.length) return
    onCambiar(conPiloto(inscritos, suyos[0].vehicle_id, activa, pilot.pilot_id))
  }

  // Cambiar de carro es sacarlo del que tenía y meterlo en el nuevo, no
  // reescribir la fila: la que deja puede seguir ocupada por el otro
  // piloto del auto, y la de destino puede existir ya.
  const elegirCarro = (pilot, vehicleId) => {
    onCambiar(conPiloto(
      sinPiloto(inscritos, activa, pilot.pilot_id),
      vehicleId, activa, pilot.pilot_id))
  }

  const alternarTodosLosPilotos = () => {
    const conCarro = corredores.filter(p => (carrosDe[p.pilot_id] || []).length)
    const todos = conCarro.length > 0 && conCarro.every(p => inscripcionDe(p.pilot_id))

    if (todos) {
      onCambiar(inscritos.filter(i => i.category_id !== activa))
      return
    }
    let salida = inscritos
    for (const p of conCarro) {
      if (inscripcionDe(p.pilot_id)) continue
      salida = conPiloto(salida, (carrosDe[p.pilot_id])[0].vehicle_id, activa, p.pilot_id)
    }
    onCambiar(salida)
  }

  // Recuento de la categoría abierta, para la cabecera de la derecha.
  const cabecera = categoria ? cuentaDe(categoria) : { total: 0, puestos: 0 }
  const completa = cabecera.total > 0 && cabecera.puestos === cabecera.total

  const alternarPiloto = (vehicleId, pilotId) => {
    onCambiar(inscritos.map(i => {
      if (i.vehicle_id !== vehicleId || i.category_id !== activa) return i
      const dentro = i.pilot_ids.includes(pilotId)
      return {
        ...i,
        pilot_ids: dentro
          ? i.pilot_ids.filter(p => p !== pilotId)
          : [...i.pilot_ids, pilotId],
      }
    }))
  }

  if (categorias.length === 0) {
    return (
      <p className="text-sm text-neutral-600 py-4">
        {t('Vuelve al paso anterior y elige al menos una categoría.')}
      </p>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Categorías a la izquierda, con cuántos carros llevan puestos. Se
          recorren una por una, que es como se arma una parrilla. */}
      <div className="md:w-56 flex-shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
        {categorias.map(c => {
          const { total, puestos, etiqueta } = cuentaDe(c)
          const esActiva = c.category_id === activa
          return (
            <button
              key={c.category_id} type="button"
              onClick={() => setActiva(c.category_id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors whitespace-nowrap md:whitespace-normal ${
                esActiva
                  ? 'border-red-600 bg-red-600/10'
                  : 'border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-bold truncate ${esActiva ? 'text-white' : 'text-neutral-300'}`}>
                  {c.category_name}
                </span>
                <span className={`block text-[11px] ${puestos ? 'text-green-500' : 'text-neutral-600'}`}>
                  {puestos} {t('de')} {total} {etiqueta}
                </span>
              </span>
              {esActiva && <ChevronRight size={15} className="text-red-500 flex-shrink-0"/>}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-w-0 bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4 max-h-[26rem] overflow-y-auto">

        {/* Con parrillas de veinte o treinta carros, marcarlos de uno en uno
            es media hora de clics. Lo normal es que corra la categoría
            entera y que se quite alguno suelto, no al revés. */}
        {cabecera.total > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800 sticky top-0 bg-[#0a0a0a] z-10">
            <div className="min-w-0">
              <p className="text-sm font-black italic text-white truncate">
                {categoria?.category_name}
              </p>
              <p className="text-[11px] text-neutral-600">
                {cabecera.puestos} {t('de')} {cabecera.total}{' '}
                {esAbierta ? t('pilotos marcados') : t('carros marcados')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (esAbierta ? alternarTodosLosPilotos() : alternarLista(carros))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs whitespace-nowrap flex-shrink-0 transition-colors ${
                completa
                  ? 'border-red-600/60 text-red-400 hover:bg-red-600/10'
                  : 'border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400'
              }`}
            >
              {completa
                ? <><Square size={13}/> {t('QUITAR TODOS')}</>
                : <><CheckSquare size={13}/> {t('MARCAR TODOS')}</>}
            </button>
          </div>
        )}

        {/* ── Categoría abierta: se eligen pilotos y su carro ────────── */}
        {esAbierta && (
          <>
            <p className="text-[11px] text-neutral-600 mb-3 -mt-1">
              {t('Corren todos los pilotos de la disciplina, con el carro que elijan. Su categoría no cambia.')}
            </p>

            {corredores.length === 0 && (
              <p className="text-sm text-neutral-600">{t('No hay pilotos registrados en esta disciplina.')}</p>
            )}

            <div className="flex flex-col gap-2">
              {corredores.map(p => {
                const suyos = carrosDe[p.pilot_id] || []
                const ins = inscripcionDe(p.pilot_id)
                const sinCarro = suyos.length === 0

                return (
                  <div
                    key={p.pilot_id}
                    className={`rounded-lg border transition-colors ${
                      ins ? 'border-red-600/60 bg-red-600/5' : 'border-neutral-800'
                    } ${sinCarro ? 'opacity-50' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={sinCarro}
                      onClick={() => alternarPilotoAbierta(p)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left disabled:cursor-not-allowed"
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        ins ? 'bg-red-600 border-red-600' : 'border-neutral-700'
                      }`}>
                        {ins && <Check size={11} className="text-white"/>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <User size={13} className={`flex-shrink-0 ${ins ? 'text-red-500' : 'text-neutral-600'}`}/>
                          <span className="text-[15px] font-bold text-white truncate leading-tight">
                            {p.name} {p.last_name}
                          </span>
                        </span>
                        <span className="block text-xs text-neutral-500 truncate mt-0.5 pl-[19px]">
                          {sinCarro
                            ? t('Sin carro registrado')
                            : ins
                              ? `${suyos.find(v => v.vehicle_id === ins.vehicle_id)?.brand || ''} ${suyos.find(v => v.vehicle_id === ins.vehicle_id)?.model || ''}`.trim()
                              : `${suyos.length} ${suyos.length === 1 ? t('carro') : t('carros')}`}
                        </span>
                      </span>
                    </button>

                    {/* Con cuál de sus carros corre. Solo cuando tiene más
                        de uno: con uno solo no hay nada que elegir. */}
                    {ins && suyos.length > 1 && (
                      <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-[42px]">
                        {suyos.map(v => {
                          const puesto = ins.vehicle_id === v.vehicle_id
                          return (
                            <button
                              key={v.vehicle_id} type="button"
                              onClick={() => elegirCarro(p, v.vehicle_id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                puesto
                                  ? 'border-green-600/60 bg-green-600/10 text-green-300'
                                  : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                              }`}
                            >
                              <Car size={12}/>
                              {v.brand} {v.model}
                              <span className="text-neutral-600">· {v.category_name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Categoría normal: la parrilla de siempre ───────────────── */}
        {!esAbierta && carros.length === 0 && (
          <p className="text-sm text-neutral-600">
            No hay vehículos registrados en {categoria?.category_name}.
          </p>
        )}

        {!esAbierta && grupos.map(grupo => {
          const claves = grupo.carros.map(v => clave(v.vehicle_id, activa))
          const puestos = claves.filter(k => seleccionados.has(k)).length
          const todos = claves.length > 0 && puestos === claves.length

          return (
            <div key={grupo.id} className="mb-5 last:mb-0">
              {/* Una categoría sin subcategorías no dibuja cabecera: sería
                  un título vacío sobre la única lista que hay. */}
              {grupo.nombre && (
                <button
                  type="button"
                  onClick={() => alternarLista(grupo.carros)}
                  className="w-full flex items-center gap-2 mb-2 pb-1.5 border-b border-neutral-800/70 text-left group"
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    todos ? 'bg-red-600 border-red-600'
                      : puestos ? 'border-red-600 bg-red-600/30'
                      : 'border-neutral-700 group-hover:border-neutral-500'
                  }`}>
                    {todos && <Check size={11} className="text-white"/>}
                  </span>
                  <Layers size={13} className="text-neutral-600 flex-shrink-0"/>
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    {grupo.nombre}
                  </span>
                  <span className={`text-[11px] ${puestos ? 'text-green-500' : 'text-neutral-600'}`}>
                    {puestos}/{claves.length}
                  </span>
                </button>
              )}

              {grupo.carros.length === 0 ? (
                <p className="text-xs text-neutral-700 pl-6 py-1">{t('Sin vehículos en esta subcategoría.')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {grupo.carros.map(v => {
                    const ins = inscritos.find(
                      i => i.vehicle_id === v.vehicle_id && i.category_id === activa)
                    return (
                      <div
                        key={v.vehicle_id}
                        className={`rounded-lg border transition-colors ${
                          ins ? 'border-red-600/60 bg-red-600/5' : 'border-neutral-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => alternarCarro(v)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left"
                        >
                          <span className={`inline-flex items-center justify-center min-w-[38px] h-8 px-2 rounded font-black font-mono text-sm flex-shrink-0 ${
                            ins ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'
                          }`}>
                            {v.display_number || v.number || '—'}
                          </span>
                          {/* El piloto va primero y el carro debajo. En esta
                              pantalla se decide quién corre, no qué máquina:
                              con el nombre en gris pequeño bajo la marca
                              había que buscarlo para leerlo. */}
                          <span className="flex-1 min-w-0">
                            {(v.pilots || []).length > 0 ? (
                              <>
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <User size={13} className={`flex-shrink-0 ${ins ? 'text-red-500' : 'text-neutral-600'}`}/>
                                  <span className="text-[15px] font-bold text-white truncate leading-tight">
                                    {v.pilots.map(p => p.name).join('  ·  ')}
                                  </span>
                                </span>
                                <span className="block text-xs text-neutral-500 truncate mt-0.5 pl-[19px]">
                                  {v.brand || t('Sin marca')} {v.model || ''}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="block text-sm font-bold text-white truncate">
                                  {v.brand || t('Sin marca')} {v.model || ''}
                                </span>
                                <span className="block text-xs text-yellow-600/80 truncate mt-0.5">
                                  {t('Sin piloto asignado')}
                                </span>
                              </>
                            )}
                          </span>
                        </button>

                        {/* Los pilotos solo se pueden ajustar en los carros
                            que ya entraron, y únicamente cuando el carro es
                            compartido: con uno solo no hay nada que elegir. */}
                        {ins && (v.pilots || []).length > 1 && (
                          <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-[62px]">
                            {v.pilots.map(p => {
                              const corre = ins.pilot_ids.includes(p.pilot_id)
                              return (
                                <button
                                  key={p.pilot_id} type="button"
                                  onClick={() => alternarPiloto(v.vehicle_id, p.pilot_id)}
                                  className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                    corre
                                      ? 'border-green-600/60 bg-green-600/10 text-green-300'
                                      : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                                  }`}
                                >
                                  {p.name}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
