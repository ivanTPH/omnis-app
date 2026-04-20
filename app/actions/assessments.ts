'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type AssessmentRow = {
  id:             string
  title:          string
  assessmentType: string
  score:          number
  date:           Date
  notes:          string | null
  teacherName:    string
  className:      string | null
}

export async function getStudentAssessments(studentId: string): Promise<AssessmentRow[]> {
  const session = await auth()
  if (!session) return []
  const { schoolId } = session.user as any

  const rows = await prisma.assessment.findMany({
    where:   { schoolId, studentId },
    orderBy: { date: 'desc' },
    select: {
      id:             true,
      title:          true,
      assessmentType: true,
      score:          true,
      date:           true,
      notes:          true,
      teacher: { select: { firstName: true, lastName: true } },
      class:   { select: { name: true } },
    },
  })

  return rows.map(r => ({
    id:             r.id,
    title:          r.title,
    assessmentType: r.assessmentType,
    score:          r.score,
    date:           r.date,
    notes:          r.notes,
    teacherName:    `${r.teacher.firstName} ${r.teacher.lastName}`,
    className:      r.class?.name ?? null,
  }))
}

export async function addAssessment(data: {
  studentId:      string
  classId?:       string | null
  title:          string
  assessmentType: string
  score:          number
  date:           string   // ISO string
  notes?:         string
}): Promise<{ id: string }> {
  const session = await auth()
  if (!session) throw new Error('Not authenticated')
  const { schoolId, id: teacherId } = session.user as any

  const record = await prisma.assessment.create({
    data: {
      schoolId,
      studentId:      data.studentId,
      classId:        data.classId ?? null,
      teacherId,
      title:          data.title,
      assessmentType: data.assessmentType,
      score:          data.score,
      date:           new Date(data.date),
      notes:          data.notes ?? null,
    },
  })

  return { id: record.id }
}

export async function deleteAssessment(id: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Not authenticated')
  const { schoolId } = session.user as any
  await prisma.assessment.deleteMany({ where: { id, schoolId } })
}
