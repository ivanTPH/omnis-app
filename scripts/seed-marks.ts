/**
 * Mark all pending demo submissions with realistic year-group-based scores.
 * Also add 3 new homework records + submissions for 8E/En1.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function maxFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object') return 9
  const keys = Object.keys(bands as Record<string, string>)
  const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length > 0 ? Math.max(...nums) : 9
}

/** Realistic score: year-group bell curve around grade 5 */
function realisticScore(max: number, yearGroup: number | null, seed: number): number {
  const mid = max * 0.55          // approx Grade 5-6
  const spread = max * 0.22
  const jitter = (Math.sin(seed * 7.3 + 1.1) * 0.5 + 0.5) * spread - spread / 2
  const ygBoost = yearGroup != null ? (yearGroup - 9) * max * 0.02 : 0
  return Math.max(Math.round(max * 0.15), Math.min(max, Math.round(mid + jitter + ygBoost)))
}

async function run() {
  // ── Part 1: Mark 73 pending demo submissions ────────────────────────────────
  const pending = await prisma.submission.findMany({
    where: {
      status:     'SUBMITTED',
      finalScore: null,
      homework:   { classId: { startsWith: 'demo-class' } },
    },
    select: {
      id:       true,
      student:  { select: { yearGroup: true } },
      homework: { select: { gradingBands: true } },
    },
  })

  console.log(`Marking ${pending.length} pending submissions…`)
  let marked = 0
  for (const [i, sub] of pending.entries()) {
    const max   = maxFromBands(sub.homework.gradingBands)
    const score = realisticScore(max, sub.student.yearGroup, i)
    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        finalScore: score,
        teacherScore: score,
        status:    'RETURNED',
        markedAt:  new Date(Date.now() - (pending.length - i) * 3_600_000), // staggered
      },
    })
    marked++
  }
  console.log(`Marked ${marked} submissions.`)

  // ── Part 2: 8E/En1 — add 3 more homework + all-student submissions ──────────
  const classId  = 'demo-class-8E-En1'
  const schoolId = 'cmm9jjy050000u1c7fxlvq4q8'

  const students = await prisma.enrolment.findMany({
    where:  { classId },
    select: { userId: true, user: { select: { yearGroup: true } } },
    distinct: ['userId'],
  })
  console.log(`\n8E/En1 students: ${students.length}`)

  const newHomeworks = [
    {
      title:       'An Inspector Calls — Characters & Responsibility',
      description: 'Analyse how Priestley presents the theme of responsibility through different characters.',
      gradingBands: { '1-3': 'Limited analysis; minimal reference to text.', '4-6': 'Some analysis with textual evidence; developing terminology.', '7-9': 'Sustained analysis; confident use of subject terminology; context integrated.' },
    },
    {
      title:       'Poetry Comparison — War & Conflict',
      description: 'Compare how two poets present the effects of conflict.',
      gradingBands: { '1-3': 'Surface comparison; limited textual support.', '4-6': 'Develops comparison with some evidence; some terminology.', '7-9': 'Perceptive comparison; well-chosen evidence; confident analysis.' },
    },
    {
      title:       'Descriptive Writing — Setting',
      description: 'Write a descriptive piece about a specific setting using varied techniques.',
      gradingBands: { '1-3': 'Basic description; limited vocabulary range.', '4-6': 'Some varied vocabulary and structural features used effectively.', '7-9': 'Sophisticated vocabulary; range of techniques; controlled structure.' },
    },
  ]

  const now = new Date()
  for (const [hi, hw] of newHomeworks.entries()) {
    const dueAt = new Date(now.getTime() - (3 - hi) * 14 * 24 * 3_600_000) // fortnightly back from now
    const setAt = new Date(dueAt.getTime() - 7 * 24 * 3_600_000)

    const created = await prisma.homework.create({
      data: {
        schoolId,
        classId,
        title:        hw.title,
        instructions: hw.description,
        type:         'SHORT_ANSWER',
        status:       'PUBLISHED',
        gradingBands: hw.gradingBands,
        createdBy:    'cmm9jjy7a0002u1c7knh3vupz', // Jay Patel
        dueAt,
      },
    })

    // Add submissions for each student
    for (const [si, enrolment] of students.entries()) {
      const max   = 9
      const score = realisticScore(max, enrolment.user.yearGroup, si + hi * 10)
      const markedAt = new Date(dueAt.getTime() + (si + 1) * 3_600_000)

      await prisma.submission.create({
        data: {
          schoolId,
          homeworkId:  created.id,
          studentId:   enrolment.userId,
          content:     'Student response submitted.',
          status:      'RETURNED',
          submittedAt: dueAt,
          markedAt,
          finalScore:  score,
          teacherScore: score,
          feedback:    `Grade ${score}/9 — ${score >= 7 ? 'Excellent work.' : score >= 5 ? 'Good effort; more evidence needed.' : 'Needs development — see feedback below.'}`,
        },
      })
    }
    console.log(`Created homework: "${hw.title}" with ${students.length} submissions`)
  }

  // Also add submissions for the existing 8E/En1 homework
  const existingHw = await prisma.homework.findFirst({
    where: { classId, title: { contains: 'Reading Fiction' } },
    select: { id: true },
  })
  if (existingHw) {
    for (const [si, enrolment] of students.entries()) {
      const existing = await prisma.submission.findFirst({
        where: { homeworkId: existingHw.id, studentId: enrolment.userId },
      })
      if (!existing) {
        const score = realisticScore(9, enrolment.user.yearGroup, si + 100)
        const dueAt = new Date(now.getTime() - 6 * 7 * 24 * 3_600_000)
        await prisma.submission.create({
          data: {
            schoolId,
            homeworkId:  existingHw.id,
            studentId:   enrolment.userId,
            content:     'Student response submitted.',
            status:      'RETURNED',
            submittedAt: dueAt,
            markedAt:    new Date(dueAt.getTime() + 3_600_000),
            finalScore:  score,
            teacherScore: score,
            feedback:    `Grade ${score}/9`,
          },
        })
      }
    }
    console.log(`Ensured submissions for existing Reading Fiction homework`)
  }

  const totalSubs = await prisma.submission.count({ where: { homework: { classId } } })
  console.log(`\n8E/En1 total submissions: ${totalSubs}`)
}

run().finally(() => prisma.$disconnect())
