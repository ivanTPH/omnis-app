/**
 * scripts/backfill-send-snapshots.ts
 *
 * One-time backfill: generate supportSnapshot for every student who has an
 * approved K Plan OR an active ILP but whose supportSnapshot is null/empty.
 *
 * Run with: npm run send:backfill-snapshots
 */

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

const anthropic = new Anthropic()

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateSnapshot(studentId: string, schoolId: string): Promise<void> {
  const [passport, ilp, student] = await Promise.all([
    prisma.learnerPassport.findFirst({
      where: { studentId, schoolId, status: 'APPROVED' },
      select: { sendInformation: true, teacherActions: true, studentCommitments: true },
      orderBy: { approvedAt: 'desc' },
    }),
    prisma.individualLearningPlan.findFirst({
      where: { studentId, schoolId, status: 'active' },
      select: {
        sendCategory: true,
        areasOfNeed: true,
        targets: { select: { target: true }, take: 3 },
      },
      orderBy: { approvedAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { firstName: true },
    }),
  ])

  if (!passport && !ilp) return

  const firstName = student?.firstName ?? 'This student'

  const sendStatusRecord = await prisma.sendStatus.findUnique({
    where: { studentId },
    select: { activeStatus: true, needArea: true },
  })
  const sendStatus   = sendStatusRecord?.activeStatus ?? 'SEN_SUPPORT'
  const needArea     = sendStatusRecord?.needArea ?? ''
  const kPlanSummary = passport?.sendInformation
    ? `K Plan summary: ${passport.sendInformation.slice(0, 300)}`
    : ''
  const ilpSummary   = ilp
    ? `SEND category: ${ilp.sendCategory}. Areas of need: ${ilp.areasOfNeed.slice(0, 200)}. Top targets: ${ilp.targets.map(t => t.target).join('; ')}`
    : ''

  const prompt = `You are summarising a student's SEND support for a busy classroom teacher. Write exactly 1–2 plain sentences (max 30 words total) that capture the key support need and the single most important classroom adjustment. Do NOT use jargon.

Student: ${firstName}
SEND status: ${sendStatus}${needArea ? ` — ${needArea}` : ''}
${kPlanSummary}
${ilpSummary}

Reply with only the 1–2 sentence summary, nothing else.`

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 150,
    messages:   [{ role: 'user', content: prompt }],
  })

  const snapshot = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join(' ')
    .trim()

  if (snapshot) {
    await prisma.user.update({
      where: { id: studentId },
      data:  { supportSnapshot: snapshot },
    })
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  SEND Snapshot Backfill')
  console.log('═══════════════════════════════════════════════\n')

  // Find all students who have an approved K Plan or active ILP
  const [passportStudents, ilpStudents] = await Promise.all([
    prisma.learnerPassport.findMany({
      where: { status: 'APPROVED' },
      select: { studentId: true, schoolId: true },
      distinct: ['studentId'],
    }),
    prisma.individualLearningPlan.findMany({
      where: { status: 'active' },
      select: { studentId: true, schoolId: true },
      distinct: ['studentId'],
    }),
  ])

  // Merge and deduplicate by studentId
  const seen = new Map<string, { studentId: string; schoolId: string }>()
  for (const r of [...passportStudents, ...ilpStudents]) {
    if (!seen.has(r.studentId)) seen.set(r.studentId, r)
  }
  const candidates = Array.from(seen.values())
  console.log(`Found ${candidates.length} student(s) with approved K Plan or active ILP.\n`)

  // Filter to those missing a snapshot
  const studentRecords = await prisma.user.findMany({
    where: {
      id: { in: candidates.map(c => c.studentId) },
      OR: [{ supportSnapshot: null }, { supportSnapshot: '' }],
    },
    select: { id: true, firstName: true, lastName: true },
  })

  const toProcess = studentRecords.map(s => ({
    ...seen.get(s.id)!,
    name: `${s.firstName} ${s.lastName}`,
  }))

  const skipped = candidates.length - toProcess.length
  console.log(`${toProcess.length} need a snapshot, ${skipped} already have one.\n`)

  let generated = 0
  let failed    = 0

  for (const s of toProcess) {
    process.stdout.write(`  Generating snapshot for ${s.name}... `)
    try {
      await generateSnapshot(s.studentId, s.schoolId)
      console.log('done')
      generated++
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message}`)
      failed++
    }
    if (toProcess.indexOf(s) < toProcess.length - 1) {
      await sleep(500)
    }
  }

  console.log('\n───────────────────────────────────────────────')
  console.log(`  Generated : ${generated}`)
  console.log(`  Skipped   : ${skipped}  (already had snapshot)`)
  console.log(`  Failed    : ${failed}`)
  console.log('───────────────────────────────────────────────\n')

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
