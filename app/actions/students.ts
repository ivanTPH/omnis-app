'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import type { ApdrRow } from '@/app/actions/send-support'

// ── Auth helpers ────────────────────────────────────────────────────────────

async function requireStaff() {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const user = session.user as { id: string; schoolId: string; role: string; firstName: string; lastName: string }
  const allowed = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN']
  if (!allowed.includes(user.role)) throw new Error('Forbidden')
  return user
}

// ── Types ────────────────────────────────────────────────────────────────────

export type StudentContact = {
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  source: 'app' | 'wonde'
}

export type SubjectPerf = {
  subject: string
  assigned: number
  submitted: number
  avgScore: number | null
  predictedScore: number | null
  baselineScore: number | null
  rag: 'green' | 'amber' | 'red' | null
}

export type HomeworkHistoryRow = {
  homeworkId: string
  submissionId: string | null
  title: string
  className: string
  subject: string
  dueAt: string
  submitted: boolean
  finalScore: number | null
  grade: string | null
  feedback: string | null
}

export type KPlanDoc = {
  id: string
  status: string
  updatedAt: Date
  approvedAt: Date | null
  approvedBy: string | null
  sendInformation: string
  teacherActions: string[]
  studentCommitments: string[]
}

export type IlpDoc = {
  id: string
  status: string
  updatedAt: Date
  reviewDate: Date | null
  approvedAt: Date | null
  approvedBy: string | null
  sendCategory: string
  areasOfNeed: string
  targets: {
    id: string
    target: string
    strategy: string | null
    successMeasure: string | null
    targetDate: Date | null
    status: string
  }[]
}

export type EhcpDoc = {
  id: string
  status: string
  updatedAt: Date
  reviewDate: Date | null
  approvedAt: Date | null
  approvedBy: string | null
  sections: Record<string, string> | null
  outcomes: {
    id: string
    section: string
    outcomeText: string
    status: string
    provisionRequired: string | null
    targetDate: Date | null
  }[]
}

export type NoteRow = {
  id: string
  content: string
  authorName: string
  createdAt: string
}

export type StudentSearchResult = {
  id: string
  firstName: string
  lastName: string
  yearGroup: number | null
}

export async function searchStudents(query: string): Promise<StudentSearchResult[]> {
  const user = await requireStaff()
  const { schoolId, id: userId, role } = user

  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const terms = trimmed.split(/\s+/).slice(0, 3)
  const nameConditions = terms.map(term => ({
    OR: [
      { firstName: { contains: term, mode: 'insensitive' as const } },
      { lastName:  { contains: term, mode: 'insensitive' as const } },
    ],
  }))

  let enrolmentFilter: object = {}
  if (role === 'TEACHER') {
    const teacherClasses = await prisma.classTeacher.findMany({
      where:  { userId },
      select: { classId: true },
    })
    const classIds = teacherClasses.map(ct => ct.classId)
    enrolmentFilter = { enrolments: { some: { classId: { in: classIds } } } }
  }

  const students = await prisma.user.findMany({
    where: {
      schoolId,
      role: 'STUDENT',
      AND: nameConditions,
      ...enrolmentFilter,
    },
    select: { id: true, firstName: true, lastName: true, yearGroup: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 10,
  })

  return students
}

export type StudentFileData = {
  student: {
    id: string
    firstName: string
    lastName: string
    email: string
    yearGroup: number | null
    tutorGroup: string | null
    dateOfBirth: Date | null
    phone: string | null
    sendStatus: string | null
    needArea: string | null
    attendancePercentage: number | null
    behaviourPositive: number | null
    behaviourNegative: number | null
    hasExclusion: boolean | null
    avatarUrl: string | null
  }
  kPlan: KPlanDoc | null
  ilp: IlpDoc | null
  ehcp: EhcpDoc | null
  apdrCycles: ApdrRow[]
  subjectPerf: SubjectPerf[]
  recentHomeworks: HomeworkHistoryRow[]
  completionRate: number
  avgScore: number | null
  notes: NoteRow[]
  parentContacts: StudentContact[]
}

// ── Main fetch ───────────────────────────────────────────────────────────────

export async function getStudentFile(studentId: string): Promise<StudentFileData | null> {
  const user = await requireStaff()
  const { schoolId } = user

  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId, role: 'STUDENT' },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      yearGroup: true, tutorGroup: true, dateOfBirth: true,
      attendancePercentage: true, behaviourPositive: true,
      behaviourNegative: true, hasExclusion: true, avatarUrl: true,
      settings: { select: { phone: true, profilePictureUrl: true } },
    },
  })
  if (!student) return null

  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)

  const [
    sendStatus,
    kPlanRaw,
    ilpRaw,
    ehcpRaw,
    enrolments,
    predictions,
    baselines,
    notes,
    parentLinks,
    wondeContacts,
    apdrCyclesRaw,
  ] = await Promise.all([
    prisma.sendStatus.findFirst({ where: { studentId } }),

    prisma.learnerPassport.findFirst({
      where: { studentId, schoolId, ...(isSenco ? {} : { status: 'APPROVED' }) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),

    prisma.individualLearningPlan.findFirst({
      where: { studentId, schoolId, status: { in: ['ACTIVE', 'UNDER_REVIEW'] } },
      include: { targets: { orderBy: { targetDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.ehcpPlan.findFirst({
      where: { studentId, schoolId, status: { in: ['ACTIVE', 'UNDER_REVIEW'] } },
      include: { outcomes: { orderBy: { targetDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.enrolment.findMany({
      where: { userId: studentId },
      include: { class: { select: { id: true, name: true, subject: true, yearGroup: true } } },
    }),

    prisma.teacherPrediction.findMany({
      where: { studentId, schoolId },
      orderBy: { updatedAt: 'desc' },
    }),

    prisma.studentBaseline.findMany({
      where: { studentId, schoolId },
    }),

    prisma.studentQuickNote.findMany({
      where: { studentId, schoolId },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),

    prisma.parentChildLink.findMany({
      where: { childId: studentId },
      include: {
        parent: {
          select: {
            firstName: true, lastName: true, email: true,
            settings: { select: { phone: true } },
          },
        },
      },
    }),

    // Try to find Wonde contacts by matching student name + year + school
    prisma.wondeStudent.findFirst({
      where: {
        schoolId,
        firstName: student.firstName,
        lastName:  student.lastName,
        ...(student.yearGroup != null ? { yearGroup: student.yearGroup } : {}),
      },
      include: { contacts: true },
    }),

    prisma.assessPlanDoReview.findMany({
      where:   { studentId, schoolId },
      orderBy: { cycleNumber: 'desc' },
    }),
  ])

  // ── Classes + homework ─────────────────────────────────────────────────────
  const classIds = enrolments.map(e => e.class.id)

  const homeworks = classIds.length > 0
    ? await prisma.homework.findMany({
        where: { schoolId, classId: { in: classIds }, status: { not: 'DRAFT' } },
        select: {
          id: true, title: true, dueAt: true, classId: true,
          class: { select: { subject: true, name: true } },
        },
        orderBy: { dueAt: 'desc' },
        take: 30,
      })
    : []

  const submissions = homeworks.length > 0
    ? await prisma.submission.findMany({
        where: { studentId, homeworkId: { in: homeworks.map(h => h.id) } },
        select: {
          id: true, homeworkId: true, finalScore: true, grade: true,
          status: true, submittedAt: true, feedback: true,
        },
      })
    : []

  const subMap = new Map(submissions.map(s => [s.homeworkId, s]))

  const recentHomeworks: HomeworkHistoryRow[] = homeworks.map(hw => {
    const sub = subMap.get(hw.id)
    return {
      homeworkId:     hw.id,
      submissionId:   sub?.id ?? null,
      title:          hw.title,
      className:      hw.class.name,
      subject:        hw.class.subject,
      dueAt:          hw.dueAt.toISOString(),
      submitted:      sub != null,
      finalScore: sub?.finalScore ?? null,
      grade:      sub?.grade ?? null,
      feedback:   sub?.feedback ?? null,
    }
  })

  // ── Subject performance + RAG ─────────────────────────────────────────────
  const predMap = new Map<string, number>()
  for (const p of predictions) {
    if (!predMap.has(p.subject)) predMap.set(p.subject, p.predictedScore)
  }
  const baseMap = new Map<string, number>()
  for (const b of baselines) baseMap.set(b.subject, b.baselineScore)

  const bySubject = new Map<string, { assigned: number; submitted: number; scores: number[] }>()
  for (const hw of recentHomeworks) {
    const r = bySubject.get(hw.subject) ?? { assigned: 0, submitted: 0, scores: [] }
    r.assigned++
    if (hw.submitted) r.submitted++
    if (hw.finalScore != null) r.scores.push(hw.finalScore)
    bySubject.set(hw.subject, r)
  }

  const subjectPerf: SubjectPerf[] = [...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([subject, row]) => {
    const avgScore = row.scores.length > 0 ? Math.round(row.scores.reduce((a, b) => a + b, 0) / row.scores.length) : null
    const predicted = predMap.get(subject) ?? null
    const baseline  = baseMap.get(subject) ?? null
    let rag: 'green' | 'amber' | 'red' | null = null
    if (avgScore != null && predicted != null) {
      const diff = avgScore - predicted
      rag = diff >= -5 ? 'green' : diff >= -15 ? 'amber' : 'red'
    }
    return { subject, assigned: row.assigned, submitted: row.submitted, avgScore, predictedScore: predicted, baselineScore: baseline, rag }
  })

  const allScores = subjectPerf.filter(r => r.avgScore != null)
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, r) => a + (r.avgScore ?? 0), 0) / allScores.length)
    : null
  const totalAssigned  = recentHomeworks.length
  const totalSubmitted = recentHomeworks.filter(h => h.submitted).length
  const completionRate = totalAssigned > 0 ? Math.round((totalSubmitted / totalAssigned) * 100) : 0

  // ── Notes ─────────────────────────────────────────────────────────────────
  const noteRows: NoteRow[] = notes.map(n => ({
    id:         n.id,
    content:    n.content,
    authorName: `${n.author.firstName} ${n.author.lastName}`,
    createdAt:  n.createdAt.toISOString(),
  }))

  // ── Contacts ──────────────────────────────────────────────────────────────
  const parentContacts: StudentContact[] = []

  // App-linked parents
  for (const link of parentLinks) {
    parentContacts.push({
      name:         `${link.parent.firstName} ${link.parent.lastName}`,
      email:        link.parent.email,
      phone:        link.parent.settings?.phone ?? null,
      relationship: link.relationshipType,
      source:       'app',
    })
  }

  // Wonde MIS contacts
  if (wondeContacts?.contacts) {
    for (const c of wondeContacts.contacts) {
      const alreadyIn = parentContacts.some(
        p => p.email && p.email.toLowerCase() === (c.email ?? '').toLowerCase()
      )
      if (!alreadyIn) {
        parentContacts.push({
          name:         `${c.firstName} ${c.lastName}`,
          email:        c.email ?? null,
          phone:        c.phone ?? null,
          relationship: c.relationship ?? null,
          source:       'wonde',
        })
      }
    }
  }

  // ── Shape documents ───────────────────────────────────────────────────────
  const kPlan: KPlanDoc | null = kPlanRaw ? {
    id:                 kPlanRaw.id,
    status:             kPlanRaw.status,
    updatedAt:          kPlanRaw.updatedAt,
    approvedAt:         kPlanRaw.approvedAt,
    approvedBy:         kPlanRaw.approvedBy,
    sendInformation:    kPlanRaw.sendInformation,
    teacherActions:     kPlanRaw.teacherActions,
    studentCommitments: kPlanRaw.studentCommitments,
  } : null

  const ilp: IlpDoc | null = ilpRaw ? {
    id:           ilpRaw.id,
    status:       ilpRaw.status,
    updatedAt:    ilpRaw.createdAt,
    reviewDate:   ilpRaw.reviewDate,
    approvedAt:   ilpRaw.approvedAt,
    approvedBy:   ilpRaw.approvedBy,
    sendCategory: ilpRaw.sendCategory,
    areasOfNeed:  ilpRaw.areasOfNeed,
    targets:      ilpRaw.targets.map(t => ({
      id:             t.id,
      target:         t.target,
      strategy:       t.strategy,
      successMeasure: t.successMeasure,
      targetDate:     t.targetDate,
      status:         t.status,
    })),
  } : null

  const ehcp: EhcpDoc | null = ehcpRaw ? {
    id:         ehcpRaw.id,
    status:     ehcpRaw.status,
    updatedAt:  ehcpRaw.updatedAt,
    reviewDate: ehcpRaw.reviewDate,
    approvedAt: ehcpRaw.approvedAt,
    approvedBy: ehcpRaw.approvedBy,
    sections:   ehcpRaw.sections as Record<string, string> | null,
    outcomes:   ehcpRaw.outcomes.map(o => ({
      id:                o.id,
      section:           o.section,
      outcomeText:       o.outcomeText,
      status:            o.status,
      provisionRequired: o.provisionRequired ?? null,
      targetDate:        o.targetDate,
    })),
  } : null

  return {
    student: {
      id:                  student.id,
      firstName:           student.firstName,
      lastName:            student.lastName,
      email:               student.email,
      yearGroup:           student.yearGroup,
      tutorGroup:          student.tutorGroup,
      dateOfBirth:         student.dateOfBirth,
      phone:               student.settings?.phone ?? null,
      sendStatus:          sendStatus?.activeStatus !== 'NONE' ? (sendStatus?.activeStatus ?? null) : null,
      needArea:            sendStatus?.needArea ?? null,
      attendancePercentage: student.attendancePercentage,
      behaviourPositive:    student.behaviourPositive,
      behaviourNegative:    student.behaviourNegative,
      hasExclusion:         student.hasExclusion,
      avatarUrl:           student.settings?.profilePictureUrl ?? student.avatarUrl ?? null,
    },
    kPlan,
    ilp,
    ehcp,
    apdrCycles: apdrCyclesRaw.map(c => ({
      id: c.id, studentId: c.studentId, schoolId: c.schoolId,
      cycleNumber: c.cycleNumber, assessContent: c.assessContent,
      planContent: c.planContent, doContent: c.doContent, reviewContent: c.reviewContent,
      status: c.status, reviewDate: c.reviewDate, createdBy: c.createdBy,
      approvedBySenco: c.approvedBySenco, approvedAt: c.approvedAt,
      approvedBy: c.approvedBy, createdAt: c.createdAt, updatedAt: c.updatedAt,
    })) as ApdrRow[],
    subjectPerf,
    recentHomeworks,
    completionRate,
    avgScore,
    notes: noteRows,
    parentContacts,
  }
}

// ── Notes ────────────────────────────────────────────────────────────────────

export async function saveStudentNote(studentId: string, content: string): Promise<void> {
  const user = await requireStaff()
  if (!content.trim()) return
  await prisma.studentQuickNote.create({
    data: { studentId, schoolId: user.schoolId, authorId: user.id, content: content.trim() },
  })
  revalidatePath(`/students/${studentId}`)
}

export async function deleteStudentNote(noteId: string, studentId: string): Promise<void> {
  const user = await requireStaff()
  const note = await prisma.studentQuickNote.findFirst({
    where: { id: noteId, schoolId: user.schoolId },
  })
  if (!note) throw new Error('Note not found')
  // Only the author or SENCO/SLT/SCHOOL_ADMIN can delete
  const canDelete = note.authorId === user.id || ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)
  if (!canDelete) throw new Error('Forbidden')
  await prisma.studentQuickNote.delete({ where: { id: noteId } })
  revalidatePath(`/students/${studentId}`)
}

// ── ILP amendment ─────────────────────────────────────────────────────────────

export async function proposeIlpFieldEdit(
  ilpId: string,
  fieldChanged: string,
  currentValue: string,
  proposedValue: string,
  studentId: string,
): Promise<void> {
  // Delegate to existing proposeIlpEdit in send-support (takes ilpId, fieldChanged, newValue)
  const { proposeIlpEdit } = await import('@/app/actions/send-support')
  await proposeIlpEdit(ilpId, fieldChanged, proposedValue)
  revalidatePath(`/students/${studentId}`)
}

// ── K Plan amendment ──────────────────────────────────────────────────────────

export async function requestKPlanAmendment(
  kPlanId: string,
  requestNote: string,
  studentId: string,
): Promise<void> {
  const user = await requireStaff()
  const { schoolId } = user

  const kPlan = await prisma.learnerPassport.findFirst({
    where: { id: kPlanId, schoolId },
    select: { studentId: true },
  })
  if (!kPlan) throw new Error('K Plan not found')

  // Find SENCO(s) in this school
  const sencos = await prisma.user.findMany({
    where: { schoolId, role: 'SENCO' },
    select: { id: true },
  })

  const requestor = `${user.firstName} ${user.lastName} (${user.role})`
  for (const senco of sencos) {
    await prisma.sendNotification.create({
      data: {
        schoolId,
        recipientId: senco.id,
        type:        'review_requested',
        title:       'K Plan amendment requested',
        body:        `${requestor} has requested changes to the K Plan:\n\n${requestNote}`,
        isRead:      false,
      },
    })
  }

  revalidatePath(`/students/${studentId}`)
}

export async function applyKPlanEdit(
  kPlanId: string,
  updates: { teacherActions?: string[]; sendInformation?: string; studentCommitments?: string[] },
  studentId: string,
): Promise<void> {
  const user = await requireStaff()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) throw new Error('Forbidden')
  const { schoolId } = user
  await prisma.learnerPassport.update({
    where: { id: kPlanId, schoolId },
    data:  {
      ...(updates.teacherActions     != null ? { teacherActions:     updates.teacherActions }     : {}),
      ...(updates.sendInformation    != null ? { sendInformation:    updates.sendInformation }    : {}),
      ...(updates.studentCommitments != null ? { studentCommitments: updates.studentCommitments } : {}),
      updatedAt: new Date(),
    },
  })
  revalidatePath(`/students/${studentId}`)
  revalidatePath('/senco/dashboard')
}

// ── AI revision suggestions ───────────────────────────────────────────────────

export async function generateRevisionSuggestions(
  studentName: string,
  subjectPerf: { subject: string; avgScore: number | null; predictedScore: number | null; rag: string | null }[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return 'Enable ANTHROPIC_API_KEY to generate AI revision suggestions.'

  const weak = subjectPerf.filter(s => s.rag === 'red' || s.rag === 'amber')
  if (weak.length === 0) return `${studentName} is performing on track across all subjects. No immediate revision priorities identified.`

  const lines = weak.map(s => `- ${s.subject}: avg ${s.avgScore ?? 'no score'}, predicted ${s.predictedScore ?? 'unknown'}`)

  const client = new Anthropic({ apiKey })
  try {
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role:    'user',
        content: `Student: ${studentName}\nUnder-performing subjects:\n${lines.join('\n')}\n\nWrite 3-5 concise, practical revision recommendations for this student's teacher in plain text. Be specific and actionable.`,
      }],
    })
    const content = msg.content[0]
    return content.type === 'text' ? content.text : 'Unable to generate suggestions.'
  } catch (err) {
    console.error('[generateRevisionSuggestions] Anthropic API error:', err)
    return 'Unable to generate AI suggestions at this time. Please try again later.'
  }
}
