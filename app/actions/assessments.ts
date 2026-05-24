'use server'
import { requireAuth } from '@/lib/session'
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
  const { schoolId } = await requireAuth()

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
  const { schoolId, id: teacherId } = await requireAuth()

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
  const { schoolId } = await requireAuth()
  await prisma.assessment.deleteMany({ where: { id, schoolId } })
}

export async function editAssessment(
  id: string,
  data: { score: number; notes?: string },
): Promise<void> {
  const { schoolId } = await requireAuth()
  await prisma.assessment.updateMany({
    where: { id, schoolId },
    data:  { score: data.score, notes: data.notes ?? null },
  })
}
