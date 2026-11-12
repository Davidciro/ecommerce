export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function escapeCell(v: string | number | boolean | null | undefined, separator: string): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  // Neutraliza fórmulas al abrir en Excel/LibreOffice (CSV injection)
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`
  if (s.includes('"') || s.includes(separator) || s.includes('\n') || s.includes('\r')) {
    s = `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Genera CSV. Separador ';' por defecto: Excel en configuración regional
 * suiza/europea lo abre correctamente en columnas.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], separator = ';'): string {
  const head = columns.map(c => escapeCell(c.header, separator)).join(separator)
  const body = rows.map(r => columns.map(c => escapeCell(c.value(r), separator)).join(separator))
  return [head, ...body].join('\r\n')
}

/** Descarga en el navegador (con BOM UTF-8 para acentos en Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
