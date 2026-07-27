import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────────────
// Exporta un módulo individual como CSV (sin dependencias)
// Usado por los botones EXPORTAR de cada sección
// ─────────────────────────────────────────────────────────────
export function exportToExcel(data, filename, columnMap = null) {
  if (!data || data.length === 0) return

  const rows = columnMap ? mapColumns(data, columnMap) : data
  const headers = Object.keys(rows[0])

  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    ),
  ]

  downloadBlob('\uFEFF' + csvLines.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;')
}

// ─────────────────────────────────────────────────────────────
// Exporta TODA la data en un solo archivo .xlsx con 4 pestañas
// Usado por el botón "Exportar Todo" del Panel de Inicio
// ─────────────────────────────────────────────────────────────
export function exportAllToExcel({ eventos, categorias, pilotos, vehiculos }) {
  const workbook = XLSX.utils.book_new()

  const sheets = [
    {
      name: 'Eventos',
      data: eventos,
      columnMap: { nombre: 'Evento', fecha: 'Fecha', ubicacion: 'Ubicación', estado: 'Estado' },
    },
    {
      name: 'Categorías',
      data: categorias,
      columnMap: { nombre: 'Categoría', restricciones: 'Reglas / Motor', peso: 'Peso Mínimo' },
    },
    {
      name: 'Pilotos',
      data: pilotos,
      columnMap: { nombre: 'Nombre', apellido: 'Apellido', sangre: 'Tipo de Sangre' },
    },
    {
      name: 'Vehículos',
      data: vehiculos,
      columnMap: { marca: 'Marca', modelo: 'Modelo / Versión', equipo: 'Equipo' },
    },
  ]

  sheets.forEach(({ name, data, columnMap }) => {
    const rows = mapColumns(data, columnMap)
    // json_to_sheet necesita al menos un objeto para generar cabeceras
    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}])
    XLSX.utils.book_append_sheet(workbook, worksheet, name)
  })

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(workbook, `RaceCore-Studio-${date}.xlsx`)
}

// ─── Helpers ──────────────────────────────────────────────────
function mapColumns(data, columnMap) {
  return data.map((row) => {
    const newRow = {}
    Object.entries(columnMap).forEach(([key, label]) => {
      if (row[key] !== undefined) newRow[label] = row[key]
    })
    return newRow
  })
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
