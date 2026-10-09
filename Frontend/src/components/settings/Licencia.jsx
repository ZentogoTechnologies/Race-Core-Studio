import { t } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldAlert, Upload, XCircle } from 'lucide-react'
import { cargarLicencia, estadoLicencia } from '../../api/registro'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

/* ==========================================================================
   LICENCIA

   Qué licencia tiene este equipo y hasta cuándo, y la forma de renovarla
   sin reinstalar: se elige el .rcslic nuevo que mandó Zentogo y el
   backend lo activa contra rcs.zentogotech.com antes de sustituir el que
   había. Si no hay internet o el servidor dice que no, se queda el de
   antes y se enseña el motivo.

   Verla puede cualquiera con sesión; cargar una nueva, solo el dueño.
========================================================================== */

// Cómo se pinta cada estado. Los que no están aquí bloquean los gráficos.
const ESTILO = {
  activa:     { color: 'text-emerald-400', borde: 'border-emerald-900/60', Icon: CheckCircle2, nombre: 'Activa' },
  desarrollo: { color: 'text-neutral-400', borde: 'border-neutral-800',    Icon: KeyRound,     nombre: 'Modo desarrollo' },
  gracia:     { color: 'text-amber-400',   borde: 'border-amber-900/60',   Icon: AlertTriangle, nombre: 'Vencida, en periodo de gracia' },
}
const BLOQUEADA = { color: 'text-red-400', borde: 'border-red-900/60', Icon: XCircle, nombre: 'Gráficos bloqueados' }

const fecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function Dato({ etiqueta, children }) {
  return (
    <div>
      <p className="text-neutral-500 text-[11px] uppercase">{t(etiqueta)}</p>
      <p className="text-white text-sm mt-0.5">{children ?? '—'}</p>
    </div>
  )
}

export default function Licencia() {
  const toast = useToast()
  const { esOwner } = useAuth()

  const [estado,    setEstado]    = useState(null)
  const [cargando,  setCargando]  = useState(true)
  const [activando, setActivando] = useState(false)
  const [error,     setError]     = useState(null)
  const input = useRef(null)

  useEffect(() => {
    estadoLicencia()
      .then(setEstado)
      .catch(e => toast.error(t('No se pudo leer la licencia'), e.message))
      .finally(() => setCargando(false))
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = async (archivo) => {
    if (!archivo) return
    setActivando(true)
    setError(null)
    try {
      const nuevo = await cargarLicencia(archivo)
      setEstado(nuevo)
      toast.exito(t('Licencia activada'), nuevo.codigo || archivo.name)
      // Avisa al resto del panel (el aviso de arriba) sin esperar a que
      // vuelva a preguntar.
      window.dispatchEvent(new Event('licencia-cambiada'))
    } catch (e) {
      setError(e.message)
    } finally {
      setActivando(false)
      if (input.current) input.current.value = ''
    }
  }

  if (cargando) {
    return (
      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6 flex items-center gap-2 text-neutral-500 text-sm">
        <Loader2 size={16} className="animate-spin"/> {t('Leyendo la licencia…')}
      </div>
    )
  }

  const estilo = (estado && ESTILO[estado.estado]) || BLOQUEADA
  const { Icon } = estilo

  return (
    <>
      <div className={`bg-[#141414] rounded-xl border ${estilo.borde} p-6`}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={17} className="text-neutral-500"/>
          <h3 className="text-lg font-black italic text-white">{t('LICENCIA')}</h3>
        </div>

        <div className={`flex items-start gap-2 mt-3 mb-5 ${estilo.color}`}>
          <Icon size={18} className="flex-shrink-0 mt-0.5"/>
          <div>
            <p className="font-bold text-sm">{t(estilo.nombre)}</p>
            {estado?.mensaje && <p className="text-sm text-neutral-400 mt-0.5">{t(estado.mensaje)}</p>}
          </div>
        </div>

        {estado && estado.estado !== 'desarrollo' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <Dato etiqueta="Código"><span className="font-mono">{estado.codigo}</span></Dato>
            <Dato etiqueta="Cliente">{estado.cliente}</Dato>
            <Dato etiqueta="Plan">{estado.plan}</Dato>
            <Dato etiqueta="Vence">{estado.vence ? fecha(estado.vence) : t('Sin vencimiento')}</Dato>
            <Dato etiqueta="Días restantes">
              {estado.dias_restantes == null ? null
                : estado.dias_restantes >= 0 ? estado.dias_restantes
                : t('Vencida')}
            </Dato>
            {estado.estado === 'gracia' && (
              <Dato etiqueta="Días de gracia">{estado.dias_de_gracia_restantes}</Dato>
            )}
          </div>
        )}
      </div>

      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Upload size={17} className="text-neutral-500"/>
          <h3 className="text-lg font-black italic text-white">{t('RENOVAR O CAMBIAR LA LICENCIA')}</h3>
        </div>

        {!esOwner ? (
          <div className="flex items-start gap-3 mt-3">
            <ShieldAlert size={18} className="text-neutral-500 flex-shrink-0 mt-0.5"/>
            <p className="text-neutral-400 text-sm">
              {t('Solo el usuario dueño puede cargar una licencia nueva.')}
            </p>
          </div>
        ) : (
          <>
            <p className="text-neutral-500 text-sm mb-5">
              {t('Elige el archivo')} <span className="text-neutral-300 font-mono">.rcslic</span> {t('que te envió Zentogo. Se activa contra el servidor de licencias, así que este equipo necesita internet en ese momento. Si algo falla, la licencia actual se queda como está.')}
            </p>

            <input
              ref={input} type="file" accept=".rcslic" className="hidden"
              onChange={e => cargar(e.target.files?.[0] || null)}
            />
            <button
              type="button" onClick={() => input.current?.click()} disabled={activando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-40"
            >
              {activando ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
              {activando ? t('ACTIVANDO…') : t('CARGAR LICENCIA')}
            </button>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-400 border border-red-900/60 rounded-lg p-3">
                <XCircle size={16} className="flex-shrink-0 mt-0.5"/>
                <span>{t(error)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
