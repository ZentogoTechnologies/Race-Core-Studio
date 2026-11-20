import { useEffect, useMemo, useRef, useState } from 'react'

/* ==========================================================================
   EL LIENZO

   Una composición de CasparCG reconstruida en el navegador: un iframe por
   capa, apilados en el mismo orden, dibujados a tamaño de emisión y
   encogidos para caber donde sea.

   Vive aparte porque lo usan dos sitios —la caja de monitores del panel y
   la pantalla de previo que se cuelga en un monitor— y tienen que enseñar
   exactamente lo mismo. Dos copias del mismo dibujo acabarían
   discrepando, y la gracia de un monitor es que no discrepe.
========================================================================== */

const ANCHO = 1920
const ALTO  = 1080


/* El backend manda fotos y logos con su dirección entera —127.0.0.1:8080—
   porque CasparCG abre la plantilla desde file://, donde una ruta relativa
   apuntaría a la raíz del disco.

   Aquí esa dirección es la equivocada: si el panel se abre desde otra
   máquina o por el túnel, 127.0.0.1 es el ordenador de quien mira. Se
   cambia por el origen que sirvió el panel, que es el mismo que sirve las
   plantillas y las imágenes.

   Se reconoce por el camino —/public/ y /media/, los dos montajes del
   backend— y no por el host, para que siga valiendo si algún día se cambia
   PUBLIC_BASE_URL. Lo que viaja por el aire no pasa por aquí y sigue
   saliendo con la dirección entera, que allí es la única que funciona. */
const SERVIDA = /^https?:\/\/[^/]+(\/(?:public|media)\/.*)$/

function reorientar(valor) {
  if (typeof valor === 'string') {
    const m = valor.match(SERVIDA)
    return m ? window.location.origin + m[1] : valor
  }
  if (Array.isArray(valor)) return valor.map(reorientar)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reorientar(v)]))
  }
  return valor
}


/* ===================================
   UNA CAPA

   La plantilla se monta una vez y a partir de ahí solo recibe datos,
   igual que al aire: UPDATE y no PLAY. Si se remontara en cada cambio
   repetiría su animación de entrada, que no es lo que pasa en la
   emisión y daría una idea falsa de cómo se ve.
=================================== */

function Capa({ capa, escala }) {
  const marco   = useRef(null)
  const montada = useRef(false)

  // Por valor y no por referencia: el objeto se rehace en cada render
  // del padre y compararlo por identidad dispararía un update continuo.
  const firma = useMemo(() => JSON.stringify(capa.data ?? null), [capa.data])

  const alimentar = () => {
    if (!capa.data) return
    try {
      // La plantilla vive en el mismo origen —la sirve el backend que
      // sirve el panel—, así que se le puede hablar. Aun así va dentro
      // de un try: una plantilla a medio cargar o sin update() no puede
      // tumbar el panel.
      marco.current?.contentWindow?.update?.(reorientar(capa.data))
    } catch { /* la vista previa nunca rompe la emisión */ }
  }

  useEffect(() => { if (montada.current) alimentar() }, [firma])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <iframe
      ref={marco}
      src={`/plantillas/${capa.path}.html`}
      title={capa.graphic_id}
      onLoad={() => { montada.current = true; alimentar() }}
      // Se dibuja a tamaño de emisión y se encoge con transform, no
      // redimensionando: a 1920 de ancho real, las proporciones, los
      // grosores de línea y los saltos de texto son los que saldrán.
      // Dándole el ancho de la caja, una plantilla pensada para 1080p
      // se recompondría y enseñaría otra cosa.
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width:  ANCHO,
        height: ALTO,
        border: 0,
        background: 'transparent',
        transform: `scale(${escala})`,
        transformOrigin: 'top left',
        // La capa de CasparCG es el orden de apilado, tal cual.
        zIndex: capa.layer,
        // Es un monitor, no un mando: un clic dentro no debe caer en la
        // plantilla ni robarle el foco al panel.
        pointerEvents: 'none',
      }}
    />
  )
}


/* ===================================
   UN MONITOR
=================================== */

function Lienzo({ capas, vacio }) {
  const caja = useRef(null)
  const [escala, setEscala] = useState(0)

  // La escala se mide, no se calcula: la caja es fluida y cambia con el
  // ancho de la ventana y con la barra lateral plegada o desplegada.
  useEffect(() => {
    const el = caja.current
    if (!el) return

    const medir = () => setEscala(el.clientWidth / ANCHO)
    medir()

    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return (
    <div
      ref={caja}
      className="relative w-full overflow-hidden rounded-lg bg-black border border-neutral-800"
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Hasta tener la medida no se monta nada: con escala 0 las
          plantillas arrancarían su animación de entrada sin que se vea,
          y entrarían ya terminadas. */}
      {escala > 0 && capas.map(c => (
        <Capa key={`${c.layer}-${c.graphic_id}`} capa={c} escala={escala} />
      ))}

      {capas.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-700">{vacio}</p>
        </div>
      )}
    </div>
  )
}


/* ===================================
   LA CAJA ENTERA
=================================== */

export { Lienzo, reorientar, ANCHO, ALTO }
