import { useState } from 'react'
import { Lienzo } from './Lienzo'
import { t } from '../../i18n'
import {
  ChevronDown, ChevronUp, ExternalLink, Loader2, MonitorPlay, Radio, Send, Undo2,
} from 'lucide-react'

/* ==========================================================================
   VISTA PREVIA

   Ver el gráfico antes de que lo vea nadie.

   No es una maqueta: son las mismas plantillas que carga CasparCG,
   servidas por el backend en /plantillas y alimentadas con el mismo
   payload que se mandaría al aire. Lo que se ve aquí es lo que sale.

   Por qué en el navegador y no en un segundo canal de CasparCG: lo caro
   de CasparCG no son las plantillas, es el vídeo —componer a 1080p60 y
   sacarlo por pantalla y NDI—. Un canal más duplicaría todo eso. Un
   iframe solo ejecuta el HTML, que es la parte barata, en una ventana
   que ya está abierta.

   La previsualización apila una capa por iframe en el mismo orden que
   CasparCG (fondo 10 detrás, barra 75 delante). Con un solo iframe se
   vería el gráfico suelto, y la pregunta que de verdad se contesta
   mirando es si choca con lo que ya está puesto.
========================================================================== */

export default function VistaPrevia({
  modo,            // 'directo' | 'previo'
  onModo,
  capasAire,       // lo que está saliendo ahora
  capasPrevio,     // lo que saldría: el aire con los cambios armados
  armados,         // cuántos gráficos esperan
  onAlAire,
  onDescartar,
  ocupado,
  pendiente,
}) {
  const [abierta, setAbierta] = useState(true)
  const previo = modo === 'previo'

  return (
    <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">

      {/* ── Cabecera: el interruptor de modo ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <button
          type="button"
          onClick={() => setAbierta(a => !a)}
          className="flex items-center gap-2.5 text-neutral-300 hover:text-white transition-colors"
        >
          <MonitorPlay size={18} className={previo ? 'text-amber-400' : 'text-red-500'} />
          <span className="text-xs font-bold uppercase tracking-widest">{t('Vista previa')}</span>
          {abierta ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        <div className="flex items-center gap-2">
          {/* Las dos pantallas de monitor, una por dirección, para
              colgarlas aparte. Van aquí porque es donde se mira el
              monitor pequeño, y de ahí sale la idea de quererlo grande.
              En pestañas nuevas: quien opera desde un iPad no puede
              perder la de los botones. */}
          {[['previo', t('Previo')], ['aire', t('Al aire')]].map(([ruta, rotulo]) => (
            <a
              key={ruta}
              href={`/${ruta}`} target="_blank" rel="noopener noreferrer"
              title={`${t('Abrir en otra pantalla')}: ${rotulo}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 transition-colors text-[11px] font-bold uppercase tracking-wider"
            >
              <ExternalLink size={13} />
              {rotulo}
            </a>
          ))}

        {/* El modo decide qué significa pulsar un gráfico, así que se
            enseña como un interruptor y no escondido en un menú. En
            modo Al aire un clic sale, sin más: una bandera roja no
            puede costar dos pulsaciones. */}
        <div className="flex gap-1 bg-[#0a0a0a] border border-neutral-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => onModo('directo')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
              !previo ? 'bg-red-600/20 text-red-400' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t('Al aire')}
          </button>
          <button
            type="button"
            onClick={() => onModo('previo')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
              previo ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t('Previo')}
          </button>
          </div>
        </div>
      </div>

      {abierta && (
        <div className="px-5 pb-5">

          <div className={previo ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>

            {/* En previo va primero el monitor de lo que se está
                preparando: se lee de izquierda a derecha, y ese es
                también el orden en que ocurre. */}
            {previo && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">
                    {t('Previo')}
                  </span>
                  <span className="text-[10px] text-neutral-600">{t('así saldrá')}</span>
                </div>
                <Lienzo capas={capasPrevio} vacio={t('Nada armado')} />
              </div>
            )}

            {/* Sin previo el monitor va solo, pero no a pantalla
                completa: ocupando todo el ancho empuja las pestañas y
                los botones fuera de la vista, y hay que verlos a la vez.
                Se queda del mismo tamaño que tendría en previo. */}
            <div className={previo ? '' : 'lg:w-1/2'}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${capasAire.length ? 'bg-red-500 animate-pulse' : 'bg-neutral-700'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${capasAire.length ? 'text-red-500' : 'text-neutral-600'}`}>
                  {t('Al aire')}
                </span>
              </div>
              <Lienzo capas={capasAire} vacio={t('Nada al aire')} />
            </div>
          </div>

          {/* ── El botón que cruza del previo al aire ── */}
          {previo && (
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={onAlAire}
                disabled={!armados || ocupado}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {pendiente
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Send size={15} />}
                {t('Al aire')}
                {armados > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-black/25 font-mono text-[11px]">{armados}</span>
                )}
              </button>

              {armados > 0 && (
                <button
                  type="button"
                  onClick={onDescartar}
                  disabled={ocupado}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white font-bold text-[11px] uppercase tracking-wider transition-colors disabled:opacity-30"
                >
                  <Undo2 size={14} />
                  {t('Descartar')}
                </button>
              )}

              <p className="text-[11px] text-neutral-500">
                {armados > 0
                  ? t('Lo armado se aplica de una vez: entra lo nuevo y sale lo que quitaste.')
                  : t('Pulsa un gráfico para armarlo. Nada sale al aire hasta que lo mandes.')}
              </p>
            </div>
          )}

          {!previo && (
            <div className="flex items-center gap-2 mt-3">
              <Radio size={13} className="text-neutral-600 shrink-0" />
              <p className="text-[11px] text-neutral-500">
                {t('Cada gráfico sale al aire al pulsarlo. Cambia a Previo para armarlo antes.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
