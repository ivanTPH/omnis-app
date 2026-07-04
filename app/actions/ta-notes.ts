'use server'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const ALLOWED_ROLES = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN','TEACHING_ASSISTANT']

async function requireAllowed() {
  const user = await requireAuth()
  if (!ALLOWED_ROLES.includes(user.role)) throw new Error('Forbidden')
  return user
}

export type TaNoteRow = {
  id:         string
  content:    string
  authorName: string
  authorRole: string
  isUrgent:   boolean
  isRead:     boolean
  classId:    string | null
  createdAt:  string
}

export async function getTaNotes(studentId: string): Promise<TaNoteRow[]> {
  const user = await requireAllowed()
  const notes = await prisma.taNote.findMany({
    where: { studentId, schoolId: user.schoolId },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return notes.map(n => ({
    id:         n.id,
    content:    n.content,
    authorName: `${n.author.firstName} ${n.author.lastName}`,
    authorRole: n.author.role,
    isUrgent:   n.isUrgent,
    isRead:     n.isRead,
    classId:    n.classId,
    createdAt:  n.createdAt.toISOString(),
  }))
}

export async function addTaNote(
  studentId: string,
  content:   string,
  isUrgent:  boolean,
  classId?:  string,
): Promise<void> {
  const user = await requireAllowed()
  if (!content.trim()) return

  await prisma.taNote.create({
    data: {
      studentId,
      schoolId:  user.schoolId,
      authorId:  user.id,
      content:   content.trim(),
      isUrgent,
      classId:   classId ?? null,
    },
  })

  // Notify class teacher(s) when a TA adds a note (at most once per hour per student)
  if (user.role === 'TEACHING_ASSISTANT' && classId) {
    const [teachers, student] = await Promise.all([
      prisma.classTeacher.findMany({ where: { classId }, select: { userId: true } }),
      prisma.user.findFirst({ where: { id: studentId }, select: { firstName: true, lastName: true } }),
    ])
    const studentName = student ? `${student.firstName} ${student.lastName}` : 'a student'
    const title = isUrgent ? `Urgent TA note: ${studentName}` : `TA note: ${studentName}`
    const body  = `${user.firstName} ${user.lastName} added a${isUrgent ? ' urgent' : ''} note about ${studentName}.`
    const oneHourAgo = new Date(Date.now() - 3_600_000)
    const teacherIds = teachers.map(t => t.userId)
    const recentlySent = await prisma.notification.findMany({
      where: {
        schoolId: user.schoolId,
        userId:   { in: teacherIds },
        type:     'GENERAL',
        linkHref: `/students/${studentId}`,
        createdAt: { gte: oneHourAgo },
      },
      select: { userId: true },
    })
    const alreadyNotified = new Set(recentlySent.map(n => n.userId))
    const toNotify = teacherIds.filter(id => !alreadyNotified.has(id))
    if (toNotify.length > 0) {
      await prisma.notification.createMany({
        data: toNotify.map(userId => ({
          schoolId: user.schoolId,
          userId,
          type:     'GENERAL',
          title,
          body,
          linkHref: `/students/${studentId}`,
        })),
      })
    }
  }

  await writeAudit({ schoolId: user.schoolId, actorId: user.id, action: 'TA_NOTE_ADDED', targetType: 'TaNote', targetId: studentId })
  revalidatePath(`/students/${studentId}`)
}

export async function markTaNoteRead(noteId: string): Promise<void> {
  const user = await requireAllowed()
  await prisma.taNote.updateMany({
    where: { id: noteId, schoolId: user.schoolId },
    data:  { isRead: true },
  })
}

export async function updateTaNote(noteId: string, studentId: string, content: string): Promise<void> {
  const user = await requireAllowed()
  const note = await prisma.taNote.findFirst({ where: { id: noteId, schoolId: user.schoolId } })
  if (!note) throw new Error('Not found')
  if (note.authorId !== user.id) throw new Error('Forbidden')
  if (!content.trim()) return
  await prisma.taNote.update({ where: { id: noteId }, data: { content: content.trim() } })
  revalidatePath(`/students/${studentId}`)
}

export async function deleteTaNote(noteId: string, studentId: string): Promise<void> {
  const user = await requireAllowed()
  const note = await prisma.taNote.findFirst({
    where: { id: noteId, schoolId: user.schoolId },
  })
  if (!note) throw new Error('Not found')
  const canDelete = note.authorId === user.id || ['SENCO','SLT','SCHOOL_ADMIN'].includes(user.role)
  if (!canDelete) throw new Error('Forbidden')
  await prisma.taNote.delete({ where: { id: noteId } })
  await writeAudit({ schoolId: user.schoolId, actorId: user.id, action: 'TA_NOTE_DELETED', targetType: 'TaNote', targetId: studentId })
  revalidatePath(`/students/${studentId}`)
}

export async function getUrgentTaNotesByClass(classId: string): Promise<{
  studentId:   string
  studentName: string
  notes:       TaNoteRow[]
}[]> {
  const user = await requireAllowed()
  const notes = await prisma.taNote.findMany({
    where: {
      schoolId: user.schoolId,
      classId,
      isUrgent: true,
      isRead:   false,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      author:  { select: { firstName: true, lastName: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by student
  const byStudent = new Map<string, { studentId: string; studentName: string; notes: TaNoteRow[] }>()
  for (const n of notes) {
    if (!byStudent.has(n.studentId)) {
      byStudent.set(n.studentId, {
        studentId:   n.studentId,
        studentName: `${n.student.firstName} ${n.student.lastName}`,
        notes: [],
      })
    }
    byStudent.get(n.studentId)!.notes.push({
      id:         n.id,
      content:    n.content,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
      authorRole: n.author.role,
      isUrgent:   n.isUrgent,
      isRead:     n.isRead,
      classId:    n.classId,
      createdAt:  n.createdAt.toISOString(),
    })
  }
  return [...byStudent.values()]
}

export type TaClass = { id: string; name: string; subject: string; yearGroup: number }

export async function getTaClasses(): Promise<TaClass[]> {
  const { schoolId } = await requireAllowed()

  const classes = await prisma.schoolClass.findMany({
    where:   { schoolId },
    select:  { id: true, name: true, subject: true, yearGroup: true },
    orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }, { name: 'asc' }],
  })

  return classes
}

export type TaSendProfile = {
  sendStatus:           string
  needArea:             string | null
  supportSnapshot:      string | null
  classroomStrategies:  string[]
  ilpTargets:           { id: string; target: string; status: string }[]
}

export async function getTaSendProfile(studentId: string): Promise<TaSendProfile | null> {
  const { schoolId } = await requireAllowed()

  const [student, profile, ilp] = await Promise.all([
    prisma.user.findFirst({
      where:  { id: studentId, schoolId },
      select: {
        sendStatus:      { select: { activeStatus: true, needArea: true } },
        supportSnapshot: true,
      },
    }),
    (prisma as any).studentLearningProfile.findUnique({
      where:  { studentId },
      select: { classroomStrategies: true },
    }).catch(() => null),
    prisma.individualLearningPlan.findFirst({
      where:   { studentId, schoolId, status: { in: ['active', 'under_review'] } },
      include: { targets: { where: { status: { in: ['active', 'achieved'] } }, select: { id: true, target: true, status: true }, take: 5 } },
    }),
  ])

  if (!student) return null

  return {
    sendStatus:          student.sendStatus?.activeStatus ?? 'NONE',
    needArea:            student.sendStatus?.needArea     ?? null,
    supportSnapshot:     student.supportSnapshot          ?? null,
    classroomStrategies: Array.isArray(profile?.classroomStrategies) ? profile.classroomStrategies : [],
    ilpTargets:          ilp?.targets.map((t: { id: string; target: string; status: string }) => ({ id: t.id, target: t.target, status: t.status })) ?? [],
  }
}

export type TaSendStudent = {
  id:                  string
  firstName:           string
  lastName:            string
  yearGroup:           number | null
  sendStatus:          string
  needArea:            string | null
  supportSnapshot:     string | null
  classroomStrategies: string[]
  ilpTargets:          { id: string; target: string; status: string }[]
  apdrPhase:           string | null
  classes:             { id: string; name: string; subject: string }[]
}

export async function getTaSendStudents(): Promise<TaSendStudent[]> {
  const { schoolId } = await requireAllowed()

  // Find all students enrolled in classes that have at least one TA note from this school
  // (TA sees SEND students across all their assigned classes)
  const sendStudents = await prisma.user.findMany({
    where: {
      schoolId,
      role: 'STUDENT',
      sendStatus: { activeStatus: { not: 'NONE' } },
    },
    select: {
      id:              true,
      firstName:       true,
      lastName:        true,
      yearGroup:       true,
      supportSnapshot: true,
      sendStatus: {
        select: { activeStatus: true, needArea: true },
      },
      enrolments: {
        select: {
          class: { select: { id: true, name: true, subject: true } },
        },
      },
    },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })

  // Fetch ILP targets and APDR data in parallel for SEND students
  const studentIds = sendStudents.map(s => s.id)
  const [ilps, apdrs] = await Promise.all([
    prisma.individualLearningPlan.findMany({
      where:   { studentId: { in: studentIds }, schoolId, status: { in: ['active', 'under_review'] } },
      select:  {
        studentId:  true,
        strategies: true,
        targets: { where: { status: { in: ['active', 'achieved'] } }, select: { id: true, target: true, status: true }, take: 4 },
      },
    }),
    prisma.assessPlanDoReview.findMany({
      where:  { studentId: { in: studentIds }, schoolId, status: 'ACTIVE' },
      select: { studentId: true, reviewContent: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const ilpMap  = new Map(ilps.map(i => [i.studentId, i]))
  const apdrMap = new Map(apdrs.map(a => [a.studentId, a]))

  return sendStudents.map(s => {
    const ilp  = ilpMap.get(s.id)
    const apdr = apdrMap.get(s.id)

    // Determine APDR phase from reviewContent keywords
    let apdrPhase: string | null = null
    if (apdr?.reviewContent) {
      if (apdr.reviewContent.toLowerCase().includes('assess')) apdrPhase = 'Assess'
      else if (apdr.reviewContent.toLowerCase().includes('plan')) apdrPhase = 'Plan'
      else apdrPhase = 'Do'
    } else if (ilp) {
      apdrPhase = 'Assess'
    }

    return {
      id:                  s.id,
      firstName:           s.firstName,
      lastName:            s.lastName,
      yearGroup:           s.yearGroup,
      sendStatus:          s.sendStatus?.activeStatus ?? 'NONE',
      needArea:            s.sendStatus?.needArea ?? null,
      supportSnapshot:     s.supportSnapshot ?? null,
      classroomStrategies: Array.isArray(ilp?.strategies) ? ilp.strategies as string[] : [],
      ilpTargets:          ilp?.targets ?? [],
      apdrPhase,
      classes:             s.enrolments.map((e: { class: { id: string; name: string; subject: string } }) => e.class),
    }
  })
}
