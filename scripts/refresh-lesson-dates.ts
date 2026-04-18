/**
 * Refresh demo lesson dates to the coming school week (Mon 20 Apr 2026).
 * Seed script already uses dynamic lessonDate() so future re-seeds will
 * automatically land on the current week. This script is for one-off DB fixes.
 *
 * Run: npm run dotenv -- npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/refresh-lesson-dates.ts
 * Or:  npx dotenv-cli -e .env.local -- npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/refresh-lesson-dates.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function mondayOfCurrentWeek(): Date {
  const now = new Date()
  const dow = now.getDay() // 0=Sun … 6=Sat
  const d = new Date(now)
  // If Saturday or Sunday, jump forward to next Monday
  if (dow === 6) d.setDate(now.getDate() + 2)        // Sat → Mon+2
  else if (dow === 0) d.setDate(now.getDate() + 1)   // Sun → Mon+1
  else d.setDate(now.getDate() - (dow - 1))           // Mon–Fri → this Monday
  d.setHours(0, 0, 0, 0)
  return d
}

function lessonDate(weekOffset: number, dayOffset: number, hour: number): Date {
  const mon = mondayOfCurrentWeek()
  mon.setDate(mon.getDate() + weekOffset * 7 + dayOffset)
  mon.setHours(hour, 0, 0, 0)
  return mon
}

async function main() {
  const monday = mondayOfCurrentWeek()
  console.log(`Target week starts: ${monday.toDateString()}`)

  // ── This week's (Mon–Fri) lessons ──────────────────────────────────────────
  const thisWeek = [
    { id: 'demo-lesson-9E-d0-h9',   day: 0, startH: 9,  endH: 10 },
    { id: 'demo-lesson-10E-d0-h11', day: 0, startH: 11, endH: 12 },
    { id: 'demo-lesson-11E-d1-h10', day: 1, startH: 10, endH: 11 },
    { id: 'demo-lesson-9E-d2-h9',   day: 2, startH: 9,  endH: 10 },
    { id: 'demo-lesson-11E-d2-h13', day: 2, startH: 13, endH: 14 },
    { id: 'demo-lesson-10E-d3-h11', day: 3, startH: 11, endH: 12 },
    { id: 'demo-lesson-9E-d4-h14',  day: 4, startH: 14, endH: 15 },
  ]

  // ── Next week's (future) lessons ───────────────────────────────────────────
  const nextWeek = [
    { id: 'demo-future-9E-d0',  day: 0, startH: 9  },
    { id: 'demo-future-10E-d1', day: 1, startH: 11 },
    { id: 'demo-future-11E-d2', day: 2, startH: 9  },
  ]

  let updated = 0

  for (const l of thisWeek) {
    const scheduledAt = lessonDate(0, l.day, l.startH)
    const endsAt      = lessonDate(0, l.day, l.endH)
    const r = await prisma.lesson.updateMany({ where: { id: l.id }, data: { scheduledAt, endsAt } })
    console.log(`  ${r.count ? '✓' : '✗'} ${l.id} → ${scheduledAt.toDateString()} ${l.startH}:00`)
    updated += r.count
  }

  for (const l of nextWeek) {
    const scheduledAt = lessonDate(1, l.day, l.startH)
    const endsAt      = lessonDate(1, l.day, l.startH + 1)
    const r = await prisma.lesson.updateMany({ where: { id: l.id }, data: { scheduledAt, endsAt } })
    console.log(`  ${r.count ? '✓' : '✗'} ${l.id} → ${scheduledAt.toDateString()} ${l.startH}:00 (next week)`)
    updated += r.count
  }

  console.log(`\nDone — ${updated} lesson${updated !== 1 ? 's' : ''} updated.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
