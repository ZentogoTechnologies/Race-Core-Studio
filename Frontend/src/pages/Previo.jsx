import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { Lienzo } from '../components/graphics/Lienzo'
import { getState } from '../api/graphics'

/* ==========================================================================
   PANTALLA DE PREVIO

   El monitor que se cuelga en una pantalla aparte. Sin barra lateral, sin
   botones: solo la composición que está saliendo, a pantalla completa.

   Existe porque quien opera lo hace desde un iPad, y ahí no cabe tener
   los botones y el monitor a la vez. Los botones se quedan en el iPad y
   el resultado se mira en un monitor.

   No recuerda nada: le pregunta al backend qué hay en cada capa y lo
   pinta. Por eso da igual desde dónde se haya mandado el gráfico —el
   iPad, el PC, otro navegador—, aquí se ve igual. Antes esa información
   solo la tenía el navegador que había mandado el gráfico, y una segunda
   pantalla no tenía forma de enterarse.

   No sustituye a la ventana de CasparCG: es el mismo HTML en otro
   navegador, sin la cámara detrás. Sirve para juzgar la composición.
========================================================================== */

/* Dos veces por segundo, el mismo ritmo al que las plantillas consultan
   el cronometraje. Lo que se mira aquí son cambios que hace una persona
   pulsando botones, así que medio segundo se percibe como inmediato y no
   hay nada que ganar preguntando más. */
const CADA = 500

/**
 * Una pantalla, un bus.
 *
 * `bus` dice cuál: "previo" o "aire". Son dos direcciones distintas —
 * /previo y /aire — porque lo que se cuelga en una pared son dos
 * monitores, no uno partido. Antes esta pantalla enseñaba las dos cajas
 * y escondía la del previo cuando no había nada armado; con un monitor
 * dedicado eso significaba verlo cambiar de tamaño solo, y quedarse sin
 * la pantalla que se había puesto ahí para mirar.
 */
export default function Previo({ bus = 'previo' }) {
  const [aire,   setAire]   = useState([])
  const [previo, setPrevio] = useState([])
  const [hayArmado, setHayArmado] = useState(false)
  const [caido,  setCaido]  = useState(false)

  const esPrevio = bus === 'previo'

  // Para no repintar cuando llega lo mismo: reasignar el src de un
  // iframe lo recarga, y eso reiniciaría la animación de entrada de cada
  // gráfico dos veces por segundo.
  const firma = useRef('')

  useEffect(() => {
    let vivo = true
    let reloj = null

    const mirar = async () => {
      try {
        const estado = await getState()
        if (!vivo) return

        const nueva = JSON.stringify([estado.al_aire, estado.previo, estado.armado])

        if (nueva !== firma.current) {
          firma.current = nueva
          setAire(estado.al_aire || [])
          setPrevio(estado.previo || [])
          setHayArmado(Object.keys(estado.armado || {}).length > 0)
        }
        setCaido(false)

      } catch {
        /* Se avisa pero no se borra lo que hay puesto: si el backend
           parpadea, es mejor seguir enseñando la última composición
           buena que dejar el monitor en negro. */
        if (vivo) setCaido(true)
      }

      if (vivo) reloj = setTimeout(mirar, CADA)
    }

    mirar()
    return () => { vivo = false; if (reloj) clearTimeout(reloj) }
  }, [])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">

      {/* El 16:9 dentro de una pantalla que puede no serlo: sin el
          límite por alto, en un monitor apaisado se saldría por abajo. */}
      <div className="w-full" style={{ maxWidth: 'min(100%, calc((100vh - 4rem) * 16 / 9))' }}>

        {esPrevio ? (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
              {t('Previo')}
              <span className="ml-2 text-neutral-600 tracking-normal normal-case">
                {hayArmado ? t('así saldrá') : t('sin cambios armados')}
              </span>
            </p>
            {/* Se enseña la composición aunque no haya nada armado, que
                entonces es la misma que está al aire. Es lo que
                significa el previo —lo que saldría si se mandara ahora—
                y deja ver sobre qué se está montando. En negro no diría
                nada y el monitor parecería caído. */}
            <Lienzo capas={previo} vacio={t('Nada al aire')} />
          </>
        ) : (
          <>
            <p className={`mb-2 text-[11px] font-bold uppercase tracking-[0.2em] ${aire.length ? 'text-red-500' : 'text-neutral-700'}`}>
              {t('Al aire')}
            </p>
            <Lienzo capas={aire} vacio={t('Nada al aire')} />
          </>
        )}
      </div>

      {caido && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-red-500">
          {t('Sin conexión con el servidor')}
        </p>
      )}
    </div>
  )
}
