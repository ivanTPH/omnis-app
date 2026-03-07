'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getStudentHomework(homeworkId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId, role } = session.user as any
  if (role !== 'STUDENT') throw new Error('Forbidden')

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId, status: 'PUBLISHED' },
    select: {
      id:           true,
      title:        true,
      instructions: true,
      dueAt:        true,
      maxAttempts:  true,
      isAdapted:    true,
      class: { select: { name: true, subject: true, yearGroup: true } },
      submissions: {
        where: { studentId: userId },
        select: {
          id:         true,
          content:    true,
          status:     true,
          grade:      true,
          feedback:   true,
          finalScore: true,
          submittedAt: true,
          markedAt:    true,
        },
      },
    },
  })
  if (!hw) return null

  const submission = hw.submissions[0] ?? null

  // Only reveal model answer once work is returned
  let modelAnswer: string | null = null
  if (submission?.status === 'RETURNED') {
    const full = await prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { modelAnswer: true },
    })
    modelAnswer = full?.modelAnswer ?? null
  }

  return { ...hw, submission, modelAnswer }
}

export async function submitHomework(homeworkId: string, content: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId, role } = session.user as any
  if (role !== 'STUDENT') throw new Error('Forbidden')

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId, status: 'PUBLISHED' },
  })
  if (!hw) throw new Error('Homework not found')

  await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId: userId } },
    create: {
      homeworkId,
      studentId:  userId,
      schoolId,
      content:    content.trim(),
      status:     'SUBMITTED',
    },
    update: {
      content:     content.trim(),
      status:      'SUBMITTED',
      submittedAt: new Date(),
    },
  })

  revalidatePath(`/student/homework/${homeworkId}`)
  revalidatePath('/student/dashboard')
}
