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

export type LearningPassportDoc = {
  id: string
  passportStatus: string
  approvedByTeacher: boolean
  approvedAt: Date | null
  approvedBy: string | null
  lastUpdated: Date | null
  workingAtGrade: number | null
  targetGrade: number | null
  predictedGrade: number | null
  strengthAreas: string[]
  developmentAreas: string[]
  classroomStrategies: string[]
  learningFormatNotes: string | null
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
  additionalSupportStrategies: string[]
  equipmentRequired: string[]
  staffNotes: string | null
  reviewDate: Date | null
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

export type WondeAttendanceSummary = {
  possibleSessions:    number | null
  presentSessions:     number | null
  authorisedAbsences:  number | null
  unauthorisedAbsences: number | null
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
  learningPassport: LearningPassportDoc | null
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
  wondeAttendance: WondeAttendanceSummary | null
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
    learningProfileRaw,
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

    prisma.studentLearningProfile.findFirst({
      where: { studentId, schoolId },
    }),

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
      include: { contacts: true, attendanceRecords: { take: 1 } },
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
  const learningPassport: LearningPassportDoc | null = learningProfileRaw ? {
    id:                  learningProfileRaw.id,
    passportStatus:      learningProfileRaw.passportStatus,
    approvedByTeacher:   learningProfileRaw.approvedByTeacher,
    approvedAt:          learningProfileRaw.approvedAt,
    approvedBy:          learningProfileRaw.approvedBy,
    lastUpdated:         learningProfileRaw.lastUpdated,
    workingAtGrade:      learningProfileRaw.workingAtGrade,
    targetGrade:         learningProfileRaw.targetGrade,
    predictedGrade:      learningProfileRaw.predictedGrade,
    strengthAreas:       learningProfileRaw.strengthAreas,
    developmentAreas:    learningProfileRaw.developmentAreas,
    classroomStrategies: learningProfileRaw.classroomStrategies,
    learningFormatNotes: learningProfileRaw.learningFormatNotes,
  } : null

  const kPlan: KPlanDoc | null = kPlanRaw ? {
    id:                          kPlanRaw.id,
    status:                      kPlanRaw.status,
    updatedAt:                   kPlanRaw.updatedAt,
    approvedAt:                  kPlanRaw.approvedAt,
    approvedBy:                  kPlanRaw.approvedBy,
    sendInformation:             kPlanRaw.sendInformation,
    teacherActions:              kPlanRaw.teacherActions,
    studentCommitments:          kPlanRaw.studentCommitments,
    additionalSupportStrategies: kPlanRaw.additionalSupportStrategies,
    equipmentRequired:           kPlanRaw.equipmentRequired,
    staffNotes:                  kPlanRaw.staffNotes,
    reviewDate:                  kPlanRaw.reviewDate,
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

  const wondeAtt = wondeContacts?.attendanceRecords?.[0] ?? null

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
    learningPassport,
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
    wondeAttendance: wondeAtt ? {
      possibleSessions:     wondeAtt.possibleSessions,
      presentSessions:      wondeAtt.presentSessions,
      authorisedAbsences:   wondeAtt.authorisedAbsences,
      unauthorisedAbsences: wondeAtt.unauthorisedAbsences,
    } : null,
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

// ── Learning Passport approval ────────────────────────────────────────────────

export async function approveLearningPassport(studentId: string): Promise<void> {
  const user = await requireStaff()
  const { schoolId } = user
  await prisma.studentLearningProfile.update({
    where:  { studentId },
    data:   {
      approvedByTeacher: true,
      approvedBy:        user.id,
      approvedAt:        new Date(),
      passportStatus:    'APPROVED',
    },
  })
  revalidatePath(`/students/${studentId}`)
}

// ── Passport recommendation (grade-drop suggestion) ───────────────────────────

export async function addPassportRecommendation(
  studentId:  string,
  suggestion: string,
): Promise<void> {
  await requireStaff()

  const existing = await (prisma as any).studentLearningProfile.findUnique({
    where:  { studentId },
    select: { classroomStrategies: true },
  })

  if (existing) {
    const updated = [...(existing.classroomStrategies ?? []), suggestion]
    await (prisma as any).studentLearningProfile.update({
      where: { studentId },
      data:  { classroomStrategies: updated, passportStatus: 'DRAFT' },
    })
  } else {
    await (prisma as any).studentLearningProfile.create({
      data: {
        studentId,
        classroomStrategies: [suggestion],
        passportStatus:      'DRAFT',
        approvedByTeacher:   false,
      },
    })
  }

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

// ── Learning Passport / Class Briefing ───────────────────────────────────────

export type ClassBriefingStudent = {
  id:                  string
  firstName:           string
  lastName:            string
  avatarUrl:           string | null
  sendCategory:        string | null   // 'EHCP' | 'SEN_SUPPORT' | null
  classroomStrategies: string[]
}

export async function getClassBriefing(classId: string): Promise<ClassBriefingStudent[]> {
  const user = await requireStaff()
  const { schoolId } = user

  const enrolments = await prisma.enrolment.findMany({
    where:    { classId, class: { schoolId } },
    select:   { userId: true },
    distinct: ['userId'],
  })
  const studentIds = enrolments.map(e => e.userId)
  if (studentIds.length === 0) return []

  const [profiles, sendStatuses] = await Promise.all([
    prisma.studentLearningProfile.findMany({
      where:  { studentId: { in: studentIds }, NOT: { classroomStrategies: { isEmpty: true } } },
      select: { studentId: true, classroomStrategies: true },
    }),
    prisma.sendStatus.findMany({
      where:  { studentId: { in: studentIds } },
      select: { studentId: true, activeStatus: true },
    }),
    prisma.user.findMany({
      where:  { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    }),
  ])

  const users = await prisma.user.findMany({
    where:  { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  })

  const profileMap = new Map(profiles.map(p => [p.studentId, p]))
  const sendMap    = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus]))

  const SEND_PRIORITY: Record<string, number> = { EHCP: 0, SEN_SUPPORT: 1 }

  return users
    .filter(u => profileMap.has(u.id))
    .map(u => {
      const profile    = profileMap.get(u.id)!
      const sendStatus = sendMap.get(u.id) ?? null
      return {
        id:                  u.id,
        firstName:           u.firstName,
        lastName:            u.lastName,
        avatarUrl:           u.avatarUrl,
        sendCategory:        sendStatus !== 'NONE' && sendStatus != null ? sendStatus : null,
        classroomStrategies: profile.classroomStrategies,
      }
    })
    .sort((a, b) => {
      const pa = SEND_PRIORITY[a.sendCategory ?? ''] ?? 2
      const pb = SEND_PRIORITY[b.sendCategory ?? ''] ?? 2
      if (pa !== pb) return pa - pb
      return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
    })
    .slice(0, 6)
}

export async function generateLearningPassport(studentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff()
  const { schoolId } = user

  const [student, sendStatus, recentSubs] = await Promise.all([
    prisma.user.findFirst({
      where:  { id: studentId, schoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true, yearGroup: true },
    }),
    prisma.sendStatus.findFirst({
      where:  { studentId },
      select: { activeStatus: true, needArea: true },
    }),
    prisma.submission.findMany({
      where:   { studentId, finalScore: { not: null }, status: { in: ['MARKED', 'RETURNED'] } },
      select:  { finalScore: true, homework: { select: { gradingBands: true, class: { select: { subject: true } } } } },
      orderBy: { markedAt: 'desc' },
      take:    20,
    }),
  ])

  if (!student) return { ok: false, error: 'Student not found' }

  // Compute working-at grade from recent submissions
  let workingAtGrade: number | null = null
  if (recentSubs.length > 0) {
    const pcts = recentSubs.map(s => {
      const bands = s.homework.gradingBands as Record<string, string> | null
      const max   = bands ? Math.max(...Object.keys(bands).flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))) || 9 : 9
      return Math.min(100, Math.round(((s.finalScore ?? 0) / max) * 100))
    })
    const avg   = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    const grade = Math.max(1, Math.min(9, Math.round(avg / 11.11)))
    workingAtGrade = grade
  }
  const targetGrade    = workingAtGrade != null ? Math.min(9, workingAtGrade + 1) : null

  // Predicted grade: base on working-at + 1 (capped at year-group ceiling),
  // or a realistic default if no homework data yet.
  const yearGroupCeiling = student.yearGroup != null
    ? student.yearGroup <= 8  ? 6   // Y7-8: realistic range 4-6
    : student.yearGroup <= 10 ? 7   // Y9-10: realistic range 4-7
    : 8                             // Y11: realistic range 4-8
    : 9
  const predictedGrade = workingAtGrade != null
    ? Math.min(yearGroupCeiling, workingAtGrade + 1)
    : student.yearGroup != null
      ? student.yearGroup <= 8  ? 5
      : student.yearGroup <= 10 ? 6
      : 7
      : null

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Stub fallback when no API key
    const strategies = [
      'Seat near the front to minimise distractions',
      'Use visual aids and worked examples',
      'Check in quietly at the start and end of each task',
    ]
    await prisma.studentLearningProfile.upsert({
      where:  { studentId },
      create: { studentId, schoolId, classroomStrategies: strategies, workingAtGrade, targetGrade, predictedGrade, lastUpdated: new Date() },
      update: { classroomStrategies: strategies, workingAtGrade, targetGrade, predictedGrade, lastUpdated: new Date() },
    })
    return { ok: true }
  }

  const subjectLines = Object.entries(
    recentSubs.reduce((acc, s) => {
      const sub = s.homework.class?.subject ?? 'General'
      if (!acc[sub]) acc[sub] = { total: 0, count: 0 }
      const bands = s.homework.gradingBands as Record<string, string> | null
      const max   = bands ? Math.max(...Object.keys(bands).flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))) || 9 : 9
      acc[sub].total += Math.min(100, Math.round(((s.finalScore ?? 0) / max) * 100))
      acc[sub].count += 1
      return acc
    }, {} as Record<string, { total: number; count: number }>),
  ).map(([subj, { total, count }]) => `- ${subj}: avg ${Math.round(total / count)}%`)

  const prompt = [
    `Student: ${student.firstName} ${student.lastName}, Year ${student.yearGroup ?? '?'}`,
    sendStatus && sendStatus.activeStatus !== 'NONE'
      ? `SEND status: ${sendStatus.activeStatus}${sendStatus.needArea ? `, need area: ${sendStatus.needArea}` : ''}`
      : 'No SEND status.',
    subjectLines.length > 0 ? `Recent homework averages:\n${subjectLines.join('\n')}` : 'No homework data yet.',
    '',
    'Generate a Learning Passport JSON with these exact keys:',
    '  strengths: string[] (2-3 academic strengths)',
    '  areasForDevelopment: string[] (2-3 development areas)',
    '  classroomStrategies: string[] (3-5 specific, practical daily strategies a teacher can act on immediately)',
    '',
    'Return ONLY valid JSON. No commentary.',
  ].join('\n')

  try {
    const client = new Anthropic({ apiKey })
    const msg    = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text    = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    const parsed  = JSON.parse(jsonStr)

    await prisma.studentLearningProfile.upsert({
      where:  { studentId },
      create: {
        studentId,
        schoolId,
        strengthAreas:       parsed.strengths           ?? [],
        developmentAreas:    parsed.areasForDevelopment ?? [],
        classroomStrategies: parsed.classroomStrategies ?? [],
        workingAtGrade,
        targetGrade,
        predictedGrade,
        lastUpdated: new Date(),
      },
      update: {
        strengthAreas:       parsed.strengths           ?? [],
        developmentAreas:    parsed.areasForDevelopment ?? [],
        classroomStrategies: parsed.classroomStrategies ?? [],
        workingAtGrade,
        targetGrade,
        predictedGrade,
        lastUpdated: new Date(),
      },
    })
    return { ok: true }
  } catch (err) {
    console.error('[generateLearningPassport] error:', err)
    return { ok: false, error: 'AI generation failed. Please try again.' }
  }
}

export async function bulkGenerateLearningPassports(
  classId: string,
): Promise<{ generated: number; errors: number }> {
  await requireStaff()

  const enrolments = await prisma.enrolment.findMany({
    where:    { classId },
    select:   { userId: true },
    distinct: ['userId'],
  })

  let generated = 0, errors = 0
  for (const { userId } of enrolments) {
    const result = await generateLearningPassport(userId)
    if (result.ok) generated++; else errors++
  }
  return { generated, errors }
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
