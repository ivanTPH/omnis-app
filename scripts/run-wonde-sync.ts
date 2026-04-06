/**
 * One-shot Wonde sync runner — uses DIRECT_URL from .env.local
 * Run: npx tsx --env-file=.env.local scripts/run-wonde-sync.ts
 */
import { PrismaClient } from '@prisma/client'
import { runWondeSync } from '../lib/wonde-sync'

const db = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

async function main() {
  const token       = process.env.WONDE_API_TOKEN
  const wondeSchId  = process.env.WONDE_SCHOOL_ID

  if (!token || !wondeSchId) {
    console.error('Missing WONDE_API_TOKEN or WONDE_SCHOOL_ID in env')
    process.exit(1)
  }

  // Get the school from DB
  const school = await db.school.findFirst()
  if (!school) {
    console.error('No school found in DB')
    process.exit(1)
  }

  console.log(`School: ${school.name} (${school.id})`)
  console.log(`Wonde school: ${wondeSchId}`)
  console.log('Starting Wonde sync...\n')

  const result = await runWondeSync(school.id, wondeSchId, token)

  console.log('\n── Sync complete ──────────────────────────────')
  console.log(`Employees:   ${result.employees.upserted}`)
  console.log(`Students:    ${result.students.upserted}`)
  console.log(`Contacts:    ${result.contacts.upserted}`)
  console.log(`Groups:      ${result.groups.upserted}`)
  console.log(`Classes:     ${result.classes.upserted}`)
  console.log(`Enrolments:  ${result.enrolments.upserted}`)
  console.log(`Periods:     ${result.periods.upserted}`)
  console.log(`Timetable:   ${result.timetable.upserted}`)
  console.log(`Duration:    ${result.durationMs}ms`)

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`)
    result.errors.forEach(e => console.log('  •', e))
  }

  // Check avatarUrl count
  const withPhoto = await db.user.count({ where: { avatarUrl: { not: null } } })
  const total     = await db.user.count()
  console.log(`\navatarUrl populated: ${withPhoto} / ${total} users`)

  // Sample one
  const sample = await db.user.findFirst({ where: { avatarUrl: { not: null } }, select: { id: true, email: true, avatarUrl: true } })
  if (sample) {
    console.log(`\nSample user: ${sample.email}`)
    console.log(`avatarUrl:   ${sample.avatarUrl}`)
  }

  await db.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
