/**
 * Minimal 5-field cron matcher (UTC): minute hour day-of-month month day-of-week.
 * Supports *, numbers, lists (1,3,5), ranges (1-5) and steps (*\/15, 0-30/10).
 * Day-of-week: 0 or 7 = Sunday. Like standard cron, when both day-of-month and
 * day-of-week are restricted, either may match.
 */
function fieldMatches(field: string, value: number, min: number, max: number, isDow = false): boolean {
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart ? parseInt(stepPart, 10) : 1
    let lo: number, hi: number
    if (rangePart === '*') { lo = min; hi = max }
    else if (rangePart.includes('-')) { const [a, b] = rangePart.split('-').map(n => parseInt(n, 10)); lo = a; hi = b }
    else { lo = hi = parseInt(rangePart, 10) }
    if (Number.isNaN(lo) || Number.isNaN(hi) || step < 1) continue
    for (let v = lo; v <= hi; v += step) {
      if (v === value || (isDow && v === 7 && value === 0)) return true
    }
  }
  return false
}

export function cronMatches(expr: string, date: Date): boolean {
  const f = expr.trim().split(/\s+/)
  if (f.length !== 5) return false
  const [mi, h, dom, mon, dow] = f
  if (!fieldMatches(mi, date.getUTCMinutes(), 0, 59)) return false
  if (!fieldMatches(h, date.getUTCHours(), 0, 23)) return false
  if (!fieldMatches(mon, date.getUTCMonth() + 1, 1, 12)) return false
  const domOk = fieldMatches(dom, date.getUTCDate(), 1, 31)
  const dowOk = fieldMatches(dow, date.getUTCDay(), 0, 7, true)
  if (dom !== '*' && dow !== '*') return domOk || dowOk
  return domOk && dowOk
}
