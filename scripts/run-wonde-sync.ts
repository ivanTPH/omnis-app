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
  console.log(`SEN records: ${result.sen.upserted}`)
  console.log(`Attendance:  ${result.attendance.upserted}`)
  console.log(`Behaviours:  ${result.behaviours.upserted}`)
  console.log(`Exclusions:  ${result.exclusions.upserted}`)
  console.log(`Assessments: ${result.assessments.upserted}`)
  console.log(`Baselines:   ${result.baselines.upserted}`)
  console.log(`Duration:    ${result.durationMs}ms`)

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`)
    result.errors.forEach(e => console.log('  •', e))
  }

  // Check avatarUrl count
  const withPhoto = await db.user.count({ where: { avatarUrl: { not: null } } })
  const total     = await db.user.count()
  console.log(`\navatarUrl populated: ${withPhoto} / ${total} users`)

  // Verify Dean Abimbola specifically
  const dean = await db.wondeStudent.findFirst({
    where: { id: 'A1204976375' },
    select: { id: true, firstName: true, lastName: true, photoUrl: true },
  })
  if (dean) {
    console.log(`\nDean Abimbola (A1204976375): photoUrl = ${dean.photoUrl ?? 'NULL'}`)
    // Check if bridged to User
    const deanUser = await db.user.findFirst({
      where: { firstName: dean.firstName, lastName: dean.lastName },
      select: { id: true, email: true, avatarUrl: true },
    })
    if (deanUser) {
      console.log(`  User match: ${deanUser.email} → avatarUrl = ${deanUser.avatarUrl ?? 'NULL'}`)
    } else {
      console.log(`  No matching User record for ${dean.firstName} ${dean.lastName}`)
    }
  } else {
    console.log('\nDean Abimbola (A1204976375): not found in WondeStudent — check school ID')
  }

  // SEN stats
  const senCount = await db.sendStatus.count({ where: { activeSource: 'Wonde MIS sync' } })
  console.log(`\nSendStatus records from Wonde: ${senCount}`)

  // Attendance stats
  const attCount = await db.wondeAttendanceRecord.count()
  console.log(`WondeAttendanceRecord total:  ${attCount}`)

  // Assessment stats
  const assCount = await db.wondeAssessmentResult.count()
  const baseCount = await db.studentBaseline.count({ where: { source: 'MIS' } })
  console.log(`WondeAssessmentResult total:  ${assCount}`)
  console.log(`StudentBaseline (MIS source): ${baseCount}`)

  // Sample user with photo
  const sample = await db.user.findFirst({ where: { avatarUrl: { not: null } }, select: { id: true, email: true, avatarUrl: true } })
  if (sample) {
    console.log(`\nSample user with photo: ${sample.email}`)
    console.log(`avatarUrl: ${sample.avatarUrl}`)
  }

  await db.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
