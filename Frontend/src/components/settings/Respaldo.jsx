import { t } from '../../i18n'
import { useRef, useState } from 'react'
import { ArchiveRestore, DatabaseBackup, Download, Loader2, ShieldAlert, Upload } from 'lucide-react'
import { descargarRespaldo, restaurarRespaldo, revisarRespaldo } from '../../api/registro'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../shared/ConfirmDialog'

/* ==========================================================================
   RESPALDO

   Todo el sistema en un solo archivo .rcs-backup: la base de datos entera
   y todas las imágenes. El archivo va sellado, así que solo sirve para
   restaurarlo aquí; con otro programa no se abre, y si se daña o se toca
   el software se niega a usarlo.

   Restaurar es en dos pasos a propósito: primero se elige el archivo y se
   enseña qué trae, y solo entonces se puede confirmar. Antes de reemplazar
   nada, el backend guarda una copia del estado actual.
========================================================================== */

const COLECCIONES = {
  pilots: 'Pilotos', vehicles: 'Vehículos', events: 'Eventos',
  categories: 'Categorías', users: 'Usuarios', trazados: 'Trazados',
  ajustes: 'Ajustes', instalacion: 'Instalación',
}

const ARCHIVOS = {
  pilotos: 'Fotos de pilotos', vehiculos: 'Fotos de vehículos',
  categorias: 'Logos de categorías', eventos: 'Imágenes de eventos',
  trazados: 'Imágenes de trazados', marcas: 'Logos de marcas',
  'logo-cliente': 'Logo del autódromo',
}

const fecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function Cifras({ titulo, datos, nombres }) {
  const filas = Object.entries(datos || {})
  if (!filas.length) return null
  return (
    <div>
      <p className="text-neutral-500 text-[11px] uppercase mb-1.5">{t(titulo)}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {filas.map(([clave, n]) => (
          <div key={clave} className="flex justify-between text-sm">
            <span className="text-neutral-400">{t(nombres[clave] || clave)}</span>
            <span className="text-white tabular-nums">{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Respaldo() {
  const toast = useToast()
  const { esOwner } = useAuth()

  const [creando,     setCreando]     = useState(false)
  const [archivo,     setArchivo]     = useState(null)
  const [revision,    setRevision]    = useState(null)
  const [revisando,   setRevisando]   = useState(false)
  const [confirmar,   setConfirmar]   = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const input = useRef(null)

  const crear = async () => {
    setCreando(true)
    try {
      const { blob, nombre } = await descargarRespaldo()
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombre
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.exito(t('Respaldo creado'), nombre)
    } catch (e) {
      toast.error(t('No se pudo crear el respaldo'), e.message)
    } finally {
      setCreando(false)
    }
  }

  const elegir = async (elegido) => {
    setArchivo(null)
    setRevision(null)
    if (!elegido) return

    setRevisando(true)
    try {
      setRevision(await revisarRespaldo(elegido))
      setArchivo(elegido)
    } catch (e) {
      toast.error(t('No se puede usar ese archivo'), e.message)
    } finally {
      setRevisando(false)
      if (input.current) input.current.value = ''
    }
  }

  const restaurar = async () => {
    setConfirmar(false)
    setRestaurando(true)
    try {
      await restaurarRespaldo(archivo)
      toast.exito(t('Respaldo restaurado'), t('Recargando el panel con los datos restaurados…'))
      // Cambió todo lo que el panel tenía cargado, cuentas incluidas: se
      // recarga entero en vez de dejar pantallas con datos de antes.
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      toast.error(t('No se pudo restaurar'), e.message)
      setRestaurando(false)
    }
  }

  if (!esOwner) {
    return (
      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6 flex items-start gap-3">
        <ShieldAlert size={18} className="text-neutral-500 flex-shrink-0 mt-0.5"/>
        <p className="text-neutral-400 text-sm">
          {t('Solo el usuario dueño puede crear y restaurar respaldos: el respaldo lleva la base entera, cuentas incluidas.')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">
        <div className="flex items-center gap-2 mb-1">
          <DatabaseBackup size={17} className="text-neutral-500"/>
          <h3 className="text-lg font-black italic text-white">{t('CREAR RESPALDO')}</h3>
        </div>
        <p className="text-neutral-500 text-sm mb-5">
          {t('Descarga un archivo')} <span className="text-neutral-300 font-mono">.rcs-backup</span> {t('con todo el sistema: pilotos, vehículos, categorías, eventos, usuarios, ajustes y todas las imágenes. Solo se puede restaurar en Race Core Studio.')}
        </p>
        <button
          type="button" onClick={crear} disabled={creando || restaurando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-40"
        >
          {creando ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
          {creando ? t('CREANDO…') : t('DESCARGAR RESPALDO')}
        </button>
      </div>

      <div className="bg-[#141414] rounded-xl border border-neutral-800 p-6">
        <div className="flex items-center gap-2 mb-1">
          <ArchiveRestore size={17} className="text-neutral-500"/>
          <h3 className="text-lg font-black italic text-white">{t('RESTAURAR RESPALDO')}</h3>
        </div>
        <p className="text-neutral-500 text-sm mb-5">
          {t('Reemplaza todo lo que hay ahora por lo que trae el respaldo. Antes de hacerlo se guarda automáticamente una copia del estado actual.')}
        </p>

        <input
          ref={input} type="file" accept=".rcs-backup" className="hidden"
          onChange={e => elegir(e.target.files?.[0] || null)}
        />
        <button
          type="button" onClick={() => input.current?.click()}
          disabled={revisando || restaurando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors font-bold text-sm"
        >
          {revisando ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
          {revisando ? t('REVISANDO…') : t('ELEGIR ARCHIVO')}
        </button>

        {revision && archivo && (
          <div className="mt-5 border border-neutral-800 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-white font-bold truncate">{archivo.name}</span>
              <span className="text-neutral-500">{t('Creado')}: {fecha(revision.creado)}</span>
            </div>

            <Cifras titulo={t('Datos')} datos={revision.colecciones} nombres={COLECCIONES}/>
            <Cifras titulo={t('Imágenes')} datos={revision.archivos} nombres={ARCHIVOS}/>

            <div className="flex justify-end">
              <button
                type="button" onClick={() => setConfirmar(true)} disabled={restaurando}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-40"
              >
                {restaurando ? <Loader2 size={16} className="animate-spin"/> : <ArchiveRestore size={16}/>}
                {restaurando ? t('RESTAURANDO…') : t('RESTAURAR ESTE RESPALDO')}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        abierto={confirmar}
        titulo={t('¿Restaurar este respaldo?')}
        mensaje={t('Se reemplazarán los pilotos, vehículos, eventos, usuarios, ajustes e imágenes por los del respaldo, y quizá tengas que volver a iniciar sesión.')}
        aviso={t('Antes se guarda una copia automática del estado actual.')}
        etiquetaConfirmar={t('RESTAURAR')}
        onCancelar={() => setConfirmar(false)}
        onConfirmar={restaurar}
      />
    </>
  )
}
