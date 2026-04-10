/**
 * Seed Learning Passports for all students.
 * - Computes workingAtGrade from recent marked submissions (if any)
 * - Sets predictedGrade by year group: Y7=4, Y8=5, Y9=5, Y10=6, Y11=6
 * - SEND students: same grade, never penalised
 * - Inserts stub strategies (no AI call — keeps this fast)
 * - Skips students who already have passportStatus = 'APPROVED'
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PREDICTED_BY_YEAR: Record<number, number> = {
  7: 4, 8: 5, 9: 5, 10: 6, 11: 6,
}

const DEFAULT_STRATEGIES = [
  'Provide written instructions alongside verbal explanations',
  'Allow processing time before expecting a response',
  'Use visual aids and worked examples where possible',
  'Check for understanding with brief one-to-one check-ins',
  'Offer sentence starters or scaffolded writing frames',
]

const SEND_EXTRA_STRATEGIES = [
  'Use coloured overlays or enlarged font if requested',
  'Break tasks into smaller, sequenced steps',
  'Seat away from distractions — near teacher if possible',
]

function maxFromBands(bands: Record<string, string> | null): number {
  if (!bands) return 9
  const nums = Object.keys(bands)
    .flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length > 0 ? Math.max(...nums) : 9
}

async function run() {
  const students = await prisma.user.findMany({
    where:   { role: 'STUDENT' },
    select:  { id: true, firstName: true, lastName: true, yearGroup: true, schoolId: true },
  })

  console.log(`Processing ${students.length} students…`)

  // Load existing approved passports — skip these
  const approved = await (prisma as any).studentLearningProfile.findMany({
    where:  { passportStatus: 'APPROVED' },
    select: { studentId: true },
  })
  const approvedIds = new Set(approved.map((r: any) => r.studentId as string))

  // Load SEND statuses
  const sendStatuses = await prisma.sendStatus.findMany({
    where:  { studentId: { in: students.map(s => s.id) } },
    select: { studentId: true, activeStatus: true, needArea: true },
  })
  const sendMap = new Map(sendStatuses.map(s => [s.studentId, s]))

  // Load recent submissions for working-at grade computation
  const subs = await prisma.submission.findMany({
    where: {
      studentId: { in: students.map(s => s.id) },
      finalScore: { not: null },
    },
    select: {
      studentId: true,
      finalScore: true,
      homework:   { select: { gradingBands: true } },
    },
    orderBy: { markedAt: 'desc' },
  })

  // Group submissions by student, keep latest 20
  const subsByStudent = new Map<string, typeof subs>()
  for (const sub of subs) {
    const arr = subsByStudent.get(sub.studentId) ?? []
    if (arr.length < 20) arr.push(sub)
    subsByStudent.set(sub.studentId, arr)
  }

  let created = 0, skipped = 0, errors = 0

  for (const student of students) {
    if (approvedIds.has(student.id)) { skipped++; continue }

    try {
      // Compute working-at grade from submissions
      let workingAtGrade: number | null = null
      const studentSubs = subsByStudent.get(student.id) ?? []
      if (studentSubs.length > 0) {
        const pcts = studentSubs.map(s => {
          const bands = s.homework.gradingBands as Record<string, string> | null
          const max   = maxFromBands(bands)
          return Math.min(100, Math.round(((s.finalScore ?? 0) / max) * 100))
        })
        const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
        workingAtGrade = Math.max(1, Math.min(9, Math.round(avg / 11.11)))
      }

      // Predicted grade: year-group based (user spec), SEND not penalised
      const yg = student.yearGroup ?? 9
      const predictedGrade = PREDICTED_BY_YEAR[yg] ?? 5

      // Working at: if no data, set 1 below predicted so there's room to grow
      if (workingAtGrade === null) {
        workingAtGrade = Math.max(1, predictedGrade - 1)
      }

      const targetGrade = Math.min(9, predictedGrade + 1)

      // Build strategies — add SEND extras if active
      const send = sendMap.get(student.id)
      const hasSend = send && send.activeStatus !== 'NONE'
      const strategies = hasSend
        ? [...DEFAULT_STRATEGIES, ...SEND_EXTRA_STRATEGIES]
        : DEFAULT_STRATEGIES

      const strengthAreas = [
        'Shows engagement during class discussion',
        'Completes tasks to the best of their ability',
      ]
      const developmentAreas = hasSend
        ? ['Building confidence with extended writing', 'Accessing extended reading tasks independently', ...(send?.needArea ? [send.needArea] : [])]
        : ['Building confidence with extended writing', 'Structuring longer analytical responses']

      await (prisma as any).studentLearningProfile.upsert({
        where:  { studentId: student.id },
        create: {
          studentId:           student.id,
          schoolId:            student.schoolId,
          workingAtGrade,
          targetGrade,
          predictedGrade,
          classroomStrategies: strategies,
          strengthAreas,
          developmentAreas,
          passportStatus:      'DRAFT',
          approvedByTeacher:   false,
          lastUpdated:         new Date(),
        },
        update: {
          workingAtGrade,
          targetGrade,
          predictedGrade,
          classroomStrategies: strategies,
          strengthAreas,
          developmentAreas,
          passportStatus:      'DRAFT',
          approvedByTeacher:   false,
          lastUpdated:         new Date(),
        },
      })

      created++
      if (created % 20 === 0) process.stdout.write(`  ${created}/${students.length}…\n`)
    } catch (err) {
      console.error(`  Error for ${student.firstName} ${student.lastName}:`, err)
      errors++
    }
  }

  const final = await (prisma as any).studentLearningProfile.count()
  console.log(`\nDone. Created/updated: ${created}, Skipped (approved): ${skipped}, Errors: ${errors}`)
  console.log(`Total passports in DB: ${final}`)
}

run().finally(() => prisma.$disconnect())
