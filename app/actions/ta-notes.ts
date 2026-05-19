'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const ALLOWED_ROLES = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN','TEACHING_ASSISTANT']

async function requireAllowed() {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const user = session.user as { id: string; schoolId: string; role: string; firstName: string; lastName: string }
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

  revalidatePath(`/students/${studentId}`)
}

export async function markTaNoteRead(noteId: string): Promise<void> {
  const user = await requireAllowed()
  await prisma.taNote.updateMany({
    where: { id: noteId, schoolId: user.schoolId },
    data:  { isRead: true },
  })
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
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const classes = await prisma.schoolClass.findMany({
    where:   { schoolId },
    select:  { id: true, name: true, subject: true, yearGroup: true },
    orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }, { name: 'asc' }],
  })

  return classes
}
