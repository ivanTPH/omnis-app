export function currentTermLabel(): string {
  const now = new Date()
  const m   = now.getMonth() // 0-indexed
  const y   = now.getFullYear()
  if (m >= 8) return `Autumn ${y}`
  if (m <= 3)  return `Spring ${y}`
  return `Summer ${y}`
}

export function termLabelToDates(label: string): { from: Date; to: Date } {
  const [term, yearStr] = label.split(' ')
  const y = parseInt(yearStr, 10)
  if (term === 'Autumn') return { from: new Date(y, 8,  1), to: new Date(y, 11, 31) }
  if (term === 'Spring') return { from: new Date(y, 0,  1), to: new Date(y,  3, 15) }
  return                        { from: new Date(y, 3, 16), to: new Date(y,  7, 31) } // Summer
}
