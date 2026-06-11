/** CSV export utility — client-side, no API route needed */

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  // Wrap in quotes if contains comma, newline, or double-quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Converts headers + row arrays into a CSV string */
export function toCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(',')),
  ]
  return lines.join('\r\n')
}

/** Triggers a browser CSV download */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
