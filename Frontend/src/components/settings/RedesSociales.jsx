import { t } from '../../i18n'
import { useEffect, useState } from 'react'
import { Loader2, Save, Share2 } from 'lucide-react'
import { guardarRedes, leerRedes } from '../../api/registro'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

/* ==========================================================================
   REDES SOCIALES

   Las cuentas que salen en el gráfico de redes. Antes el gráfico solo
   tenía sus textos de fábrica y no había dónde poner las del autódromo;
   ahora se escriben aquí una vez y el botón de Gráficos las saca solas.

   La que se deja vacía no sale: el gráfico oculta esa fila en vez de
   enseñar un icono sin nada al lado.
========================================================================== */

const CAMPOS = [
  { id: 'instagram', etiqueta: 'Instagram', ejemplo: '@tu_cuenta' },
  { id: 'youtube',   etiqueta: 'YouTube',   ejemplo: '@tu_canal' },
  { id: 'website',   etiqueta: 'Sitio web', ejemplo: 'tusitio.com' },
]

const VACIAS = { instagram: '', youtube: '', website: '' }

export default function RedesSociales() {
  const toast = useToast()
  const { puedeEscribir } = useAuth()

  const [valores,   setValores]   = useState(VACIAS)
  const [guardadas, setGuardadas] = useState(VACIAS)
  const [cargando,  setCargando]  = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    leerRedes()
      .then(r => { setValores(r); setGuardadas(r) })
      .catch(e => toast.error(t('No se pudieron leer las redes'), e.message))
      .finally(() => setCargando(false))
  }, [])

  const hayCambios = CAMPOS.some(c => (valores[c.id] || '') !== (guardadas[c.id] || ''))

  const guardar = async () => {
    setGuardando(true)
    try {
      const r = await guardarRedes(valores)
      setValores(r)
      setGuardadas(r)
      toast.exito(t('Redes guardadas'), t('El gráfico de redes ya sale con estas cuentas'))
    } catch (e) {
      toast.error(t('No se pudieron guardar las redes'), e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Share2 size={17} className="text-neutral-500"/>
        <h3 className="text-lg font-black italic text-white">{t('REDES SOCIALES')}</h3>
      </div>
      <p className="text-neutral-500 text-sm mb-5">
        {t('Las cuentas que salen en el gráfico de redes sociales. La que dejes vacía no aparece en el gráfico.')}
      </p>

      {cargando ? (
        <div className="py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-red-600"/>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {CAMPOS.map(({ id, etiqueta, ejemplo }) => (
              <div key={id} className="grid sm:grid-cols-[140px_1fr] items-center gap-2 sm:gap-4">
                <label htmlFor={`red-${id}`} className="text-neutral-400 text-xs uppercase">
                  {t(etiqueta)}
                </label>
                <input
                  id={`red-${id}`} type="text" maxLength={80}
                  value={valores[id] || ''} placeholder={ejemplo}
                  disabled={!puedeEscribir}
                  onChange={e => setValores(v => ({ ...v, [id]: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2.5 text-sm text-white focus:border-red-600 focus:outline-none disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-5">
            {!puedeEscribir && (
              <span className="text-xs text-neutral-600">{t('Solo un administrador puede cambiarlas.')}</span>
            )}
            <button
              type="button" onClick={guardar}
              disabled={!puedeEscribir || !hayCambios || guardando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
              {t('GUARDAR')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
