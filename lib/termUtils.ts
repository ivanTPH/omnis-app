export function currentTermLabel(): string {
  const now = new Date()
  const m   = now.getMonth() // 0-indexed
  const y   = now.getFullYear()
  if (m >= 8) return `Autumn ${y}`
  if (m <= 3)  return `Spring ${y}`
  return `Summer ${y}`
}

/**
 * The school's current term, computed from today's date — never a frozen
 * value left over from whenever demo data was last seeded. Prefers the
 * school's own configured TermDate rows (set via /admin, synced from a
 * MIS, or entered manually) when one covers today; falls back to the
 * generic UK-term-by-month heuristic in currentTermLabel() when the
 * school hasn't configured any (or none happens to cover today, e.g. a
 * holiday week with no TermDate row).
 */
export async function getCurrentTermLabel(schoolId: string): Promise<string> {
  const { prisma } = await import('@/lib/prisma')
  const now = new Date()
  const current = await prisma.termDate.findFirst({
    where: { schoolId, startsAt: { lte: now }, endsAt: { gte: now } },
    select: { label: true },
  })
  return current?.label ?? currentTermLabel()
}

export function termLabelToDates(label: string): { from: Date; to: Date } {
  const [term, yearStr] = label.split(' ')
  const y = parseInt(yearStr, 10)
  if (term === 'Autumn') return { from: new Date(y, 8,  1), to: new Date(y, 11, 31) }
  if (term === 'Spring') return { from: new Date(y, 0,  1), to: new Date(y,  3, 15) }
  return                        { from: new Date(y, 3, 16), to: new Date(y,  7, 31) } // Summer
}
