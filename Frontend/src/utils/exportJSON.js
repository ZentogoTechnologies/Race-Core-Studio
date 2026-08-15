/**
 * Exporta un array de entidades a un archivo .json
 * Usado por el botón EXPORTAR de cada módulo individual
 *
 * @param {Array}  data         - Datos a exportar
 * @param {string} fileName     - Nombre del archivo sin extensión
 * @param {Object} columnMap    - Mapa opcional { clave: 'Nombre legible' } para renombrar campos
 */
export function exportToJSON(data, fileName, columnMap = null) {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar.')
    return
  }

  const payload = columnMap
    ? data.map(row => {
        const renamedRow = {}
        Object.entries(columnMap).forEach(([key, label]) => {
          if (row[key] !== undefined) renamedRow[label] = row[key]
        })
        return renamedRow
      })
    : data

  downloadJSON(payload, fileName)
}

/**
 * Exporta TODA la data del sistema en un único .json estructurado
 * Usado por el botón "Exportar Todo" del Panel de Inicio
 *
 * @param {Object} allData - { eventos, categorias, pilotos, vehiculos }
 */
export function exportAllToJSON({ eventos, categorias, pilotos, vehiculos }) {
  const payload = {
    exportDate:    new Date().toISOString(),
    softwareVersion: '1.0.0',
    data: {
      eventos,
      categorias,
      pilotos,
      vehiculos,
    },
  }

  const date = new Date().toISOString().split('T')[0]
  downloadJSON(payload, `RaceCore-Studio-${date}`)
}

// ─── Helper ───────────────────────────────────────────────────
function downloadJSON(payload, fileName) {
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json' }
  )
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `${fileName}.json`
  link.click()
  URL.revokeObjectURL(url)
}
