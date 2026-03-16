import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL ?? ''
const connUrl = dbUrl.includes('?') ? dbUrl + '&connection_limit=1' : dbUrl + '?connection_limit=1'
const prisma = new PrismaClient({ datasources: { db: { url: connUrl } } })

async function main() {
  console.log('Seeding revision programs…')

  // Find an English teacher and their class
  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER', email: { contains: 'patel' } },
    select: { id: true, schoolId: true },
  })
  if (!teacher) { console.log('No teacher found — skipping'); return }

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { schoolId: teacher.schoolId, subject: { contains: 'English' } },
    include: {
      enrolments: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        take: 5,
      },
    },
  })
  if (!schoolClass) { console.log('No English class found — skipping'); return }

  const students = schoolClass.enrolments.map(e => e.user).slice(0, 5)
  if (students.length === 0) { console.log('No students — skipping'); return }

  const now = new Date()

  // ── 1. Formal assignment ───────────────────────────────────────────────────
  const program1 = await (prisma as any).revisionProgram.create({
    data: {
      schoolId:     teacher.schoolId,
      classId:      schoolClass.id,
      createdBy:    teacher.id,
      title:        'An Inspector Calls — Mid-Term Revision',
      subject:      schoolClass.subject,
      yearGroup:    schoolClass.yearGroup,
      periodStart:  new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000),
      periodEnd:    now,
      topics:       ['Context & Social Class', 'Character Analysis', 'Inspector\'s Role'],
      mode:         'formal_assignment',
      deadline:     new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      durationWeeks: 1,
      status:       'sent',
    },
  })

  const statuses = ['not_started', 'submitted', 'marked', 'not_started', 'submitted']
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const status = statuses[i] ?? 'not_started'
    await (prisma as any).revisionTask.create({
      data: {
        programId:    program1.id,
        studentId:    s.id,
        schoolId:     teacher.schoolId,
        focusTopics:  ['Context & Social Class', 'Inspector\'s Role'],
        taskType:     'retrieval_practice',
        instructions: `Complete this retrieval practice task on 'An Inspector Calls'. Focus on the role of Inspector Goole and the themes of social class and responsibility. Answer each question fully, using evidence from the text.`,
        weakTopics:   ['Context & Social Class'],
        strongTopics: ['Character Analysis'],
        sendAdaptations: [],
        ilpTargetIds: [],
        estimatedMins: 30,
        status,
        submittedAt:  status === 'submitted' || status === 'marked' ? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) : null,
        teacherScore: status === 'marked' ? 6 : null,
        finalScore:   status === 'marked' ? 6 : null,
        feedback:     status === 'marked' ? 'Good understanding of context. Develop your analysis of the Inspector\'s role further — consider the dramatic impact.' : null,
        markedAt:     status === 'marked' ? new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) : null,
      },
    })
  }
  console.log(`✓ Formal assignment created with ${students.length} tasks`)

  // ── 2. Study guide ─────────────────────────────────────────────────────────
  const program2 = await (prisma as any).revisionProgram.create({
    data: {
      schoolId:     teacher.schoolId,
      classId:      schoolClass.id,
      createdBy:    teacher.id,
      title:        'Descriptive Writing — Revision Guide',
      subject:      schoolClass.subject,
      yearGroup:    schoolClass.yearGroup,
      periodStart:  new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      periodEnd:    now,
      topics:       ['Descriptive Techniques', 'Structural Features', 'Vocabulary & Tone'],
      mode:         'study_guide',
      deadline:     null,
      durationWeeks: 1,
      status:       'sent',
    },
  })

  const sgStatuses = ['not_started', 'not_started', 'submitted', 'submitted', 'not_started']
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const status = sgStatuses[i] ?? 'not_started'
    await (prisma as any).revisionTask.create({
      data: {
        programId:    program2.id,
        studentId:    s.id,
        schoolId:     teacher.schoolId,
        focusTopics:  ['Descriptive Techniques', 'Vocabulary & Tone'],
        taskType:     'short_answer',
        instructions: `Work through these descriptive writing practice tasks at your own pace. Focus on using a variety of techniques and developing your vocabulary. No deadline — take your time and aim for quality.`,
        weakTopics:   ['Descriptive Techniques'],
        strongTopics: ['Structural Features'],
        sendAdaptations: [],
        ilpTargetIds: [],
        estimatedMins: 30,
        status,
        completedAt:  status === 'submitted' ? new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) : null,
        selfConfidence: status === 'submitted' ? 3 : null,
      },
    })
  }
  console.log(`✓ Study guide created with ${students.length} tasks`)

  console.log('\nRevision seed complete ✓')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
