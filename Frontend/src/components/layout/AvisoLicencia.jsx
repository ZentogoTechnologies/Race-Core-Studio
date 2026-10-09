import { t } from '../../i18n'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, XCircle } from 'lucide-react'
import { estadoLicencia } from '../../api/registro'
import { useAuth } from '../../context/AuthContext'

/* ==========================================================================
   AVISO DE LICENCIA

   Una franja encima de cada pantalla cuando la licencia pide atención:
   en ámbar mientras dura la gracia (los gráficos siguen saliendo) y en
   rojo cuando ya están bloqueados. Sin esto, lo único que vería quien
   opera es que los gráficos fallan, sin saber por qué.

   Se vuelve a preguntar cada pocos minutos —la gracia se acaba a una hora
   concreta, aunque nadie recargue— y al instante cuando Ajustes carga una
   licencia nueva. Si el backend no contesta, no se enseña nada: de eso ya
   avisa el resto del panel.
========================================================================== */

const CADA_MS = 5 * 60 * 1000

export default function AvisoLicencia() {
  const { rol } = useAuth()
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    let vivo = true
    const preguntar = () =>
      estadoLicencia().then(e => vivo && setEstado(e)).catch(() => {})

    preguntar()
    const reloj = setInterval(preguntar, CADA_MS)
    window.addEventListener('licencia-cambiada', preguntar)
    return () => {
      vivo = false
      clearInterval(reloj)
      window.removeEventListener('licencia-cambiada', preguntar)
    }
  }, [])

  if (!estado || estado.estado === 'activa' || estado.estado === 'desarrollo') return null

  const gracia = estado.estado === 'gracia'
  const Icon = gracia ? AlertTriangle : XCircle
  // Ajustes es de owner y admin; al resto se le dice a quién acudir.
  const puedeRenovar = rol === 'owner' || rol === 'admin'

  return (
    <div className={`flex items-center gap-3 px-8 py-2.5 text-sm border-b z-10 ${
      gracia ? 'bg-amber-950/60 border-amber-900/60 text-amber-300'
             : 'bg-red-950/60 border-red-900/60 text-red-300'}`}
    >
      <Icon size={16} className="flex-shrink-0"/>
      <span className="flex-1">{t(estado.mensaje)}</span>
      {puedeRenovar ? (
        <Link to="/ajustes?pestana=licencia" className="font-bold underline underline-offset-2 whitespace-nowrap">
          {t('Ver licencia')}
        </Link>
      ) : (
        <span className="whitespace-nowrap opacity-80">{t('Avise al administrador')}</span>
      )}
    </div>
  )
}
