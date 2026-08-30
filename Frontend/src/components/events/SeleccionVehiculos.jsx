import { useMemo, useState } from 'react'
import { Check, CheckSquare, ChevronRight, Layers, Square, User } from 'lucide-react'

const SIN_SUB = '__sin__'

/**
 * Segundo paso del alta de un evento: qué carros corren, categoría por
 * categoría.
 *
 * Dentro de cada categoría los carros van agrupados por subcategoría,
 * porque es la unidad con la que se decide en pista: no se elige "los de
 * Gran Turismo", se elige quiénes corren en Gran Turismo 1, quiénes en el
 * 2, y así. Las categorías sin subcategorías muestran la lista plana.
 */
export default function SeleccionVehiculos({ categorias, vehiculos, inscritos, onCambiar }) {
  const [activa, setActiva] = useState(categorias[0]?.category_id ?? null)

  const porCategoria = useMemo(() => {
    const mapa = {}
    for (const c of categorias) {
      mapa[c.category_id] = vehiculos.filter(v => v.category_id === c.category_id)
    }
    return mapa
  }, [categorias, vehiculos])

  const seleccionados = useMemo(
    () => new Set(inscritos.map(i => i.vehicle_id)),
    [inscritos],
  )

  const cuentaDe = (categoryId) => {
    const total = (porCategoria[categoryId] || []).length
    const puestos = (porCategoria[categoryId] || [])
      .filter(v => seleccionados.has(v.vehicle_id)).length
    return { total, puestos }
  }

  const categoria = categorias.find(c => c.category_id === activa)
  const carros = porCategoria[activa] || []

  // Los grupos salen de las subcategorías declaradas en la categoría, más
  // uno final para los carros que no tienen ninguna asignada. Se recorren
  // las declaradas y no los valores presentes en los carros para que una
  // subcategoría sin inscritos todavía aparezca y se pueda llenar.
  const grupos = useMemo(() => {
    if (!categoria) return []

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
        nombre: declaradas.length ? 'Sin subcategoría' : null,
        carros: huerfanos,
      })
    }

    return declaradas
  }, [categoria, carros])

  const alternarCarro = (v) => {
    if (seleccionados.has(v.vehicle_id)) {
      onCambiar(inscritos.filter(i => i.vehicle_id !== v.vehicle_id))
      return
    }
    // Al inscribir un carro entran todos sus pilotos: lo normal es que
    // corran todos, y quitar uno es más rápido que agregarlos de a uno.
    onCambiar([...inscritos, {
      vehicle_id: v.vehicle_id,
      pilot_ids: (v.pilots || []).map(p => p.pilot_id),
    }])
  }

  // Marca la lista entera, o la vacía si ya estaba completa. Sirve igual
  // para una subcategoría que para la categoría completa, que es la misma
  // operación sobre distintos conjuntos de carros.
  const alternarLista = (lista) => {
    const ids = lista.map(v => v.vehicle_id)
    const todos = ids.length > 0 && ids.every(id => seleccionados.has(id))

    if (todos) {
      onCambiar(inscritos.filter(i => !ids.includes(i.vehicle_id)))
      return
    }

    // Solo se añaden los que faltan: volver a meter uno ya inscrito
    // duplicaría la fila y perdería los pilotos que se hubieran quitado.
    const faltan = lista.filter(v => !seleccionados.has(v.vehicle_id))
    onCambiar([...inscritos, ...faltan.map(v => ({
      vehicle_id: v.vehicle_id,
      pilot_ids: (v.pilots || []).map(p => p.pilot_id),
    }))])
  }

  // Recuento de la categoría abierta, para la cabecera de la derecha.
  const todosDeCategoria = (() => {
    const total = carros.length
    const puestos = carros.filter(v => seleccionados.has(v.vehicle_id)).length
    return { total, puestos, completa: total > 0 && puestos === total }
  })()

  const alternarPiloto = (vehicleId, pilotId) => {
    onCambiar(inscritos.map(i => {
      if (i.vehicle_id !== vehicleId) return i
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
        Vuelve al paso anterior y elige al menos una categoría.
      </p>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Categorías a la izquierda, con cuántos carros llevan puestos. Se
          recorren una por una, que es como se arma una parrilla. */}
      <div className="md:w-56 flex-shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
        {categorias.map(c => {
          const { total, puestos } = cuentaDe(c.category_id)
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
                  {puestos} de {total} carro{total === 1 ? '' : 's'}
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
        {carros.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800 sticky top-0 bg-[#0a0a0a] z-10">
            <div className="min-w-0">
              <p className="text-sm font-black italic text-white truncate">
                {categoria?.category_name}
              </p>
              <p className="text-[11px] text-neutral-600">
                {todosDeCategoria.puestos} de {todosDeCategoria.total} carros marcados
              </p>
            </div>
            <button
              type="button"
              onClick={() => alternarLista(carros)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs whitespace-nowrap flex-shrink-0 transition-colors ${
                todosDeCategoria.completa
                  ? 'border-red-600/60 text-red-400 hover:bg-red-600/10'
                  : 'border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-red-400'
              }`}
            >
              {todosDeCategoria.completa
                ? <><Square size={13}/> QUITAR TODOS</>
                : <><CheckSquare size={13}/> MARCAR TODOS</>}
            </button>
          </div>
        )}

        {carros.length === 0 && (
          <p className="text-sm text-neutral-600">
            No hay vehículos registrados en {categoria?.category_name}.
          </p>
        )}

        {grupos.map(grupo => {
          const ids = grupo.carros.map(v => v.vehicle_id)
          const puestos = ids.filter(id => seleccionados.has(id)).length
          const todos = ids.length > 0 && puestos === ids.length

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
                    {puestos}/{ids.length}
                  </span>
                </button>
              )}

              {grupo.carros.length === 0 ? (
                <p className="text-xs text-neutral-700 pl-6 py-1">Sin vehículos en esta subcategoría.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {grupo.carros.map(v => {
                    const ins = inscritos.find(i => i.vehicle_id === v.vehicle_id)
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
                            {v.display_number || v.number}
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
                                  {v.brand || 'Sin marca'} {v.model || ''}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="block text-sm font-bold text-white truncate">
                                  {v.brand || 'Sin marca'} {v.model || ''}
                                </span>
                                <span className="block text-xs text-yellow-600/80 truncate mt-0.5">
                                  Sin piloto asignado
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
