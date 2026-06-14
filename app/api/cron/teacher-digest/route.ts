import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTeacherDigestEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'

  // Find all active TEACHER / HEAD_OF_DEPT accounts with an email
  const teachers = await prisma.user.findMany({
    where: {
      role:     { in: ['TEACHER', 'HEAD_OF_DEPT'] },
      isActive: true,
      email:    { not: '' },
    },
    select: {
      id:        true,
      email:     true,
      firstName: true,
      schoolId:  true,
    },
  })

  const now       = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  let sent = 0

  await Promise.allSettled(
    teachers.map(async teacher => {
      // Classes this teacher teaches
      const classTeachers = await prisma.classTeacher.findMany({
        where: { userId: teacher.id },
        select: { classId: true, class: { select: { name: true } } },
      })
      if (classTeachers.length === 0) return

      const classIds = classTeachers.map(ct => ct.classId)

      // Ungraded submissions (SUBMITTED or UNDER_REVIEW)
      const ungradedCount = await prisma.submission.count({
        where: {
          schoolId:   teacher.schoolId,
          status:     { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          homework:   { classId: { in: classIds } },
        },
      })

      // Homework due this week
      const dueThisWeek = await prisma.homework.findMany({
        where: {
          classId:  { in: classIds },
          status:   'PUBLISHED',
          dueAt:    { gte: weekStart, lt: weekEnd },
        },
        select: {
          title:   true,
          dueAt:   true,
          classId: true,
        },
        orderBy: { dueAt: 'asc' },
        take: 10,
      })

      // Per-class submission stats (last 30 days of published homework)
      const since30d = new Date(now.getTime() - 30 * 86_400_000)
      const classStats = await Promise.all(
        classTeachers.map(async ct => {
          const [enrolled, hwIds] = await Promise.all([
            prisma.enrolment.count({ where: { classId: ct.classId } }),
            prisma.homework.findMany({
              where: { classId: ct.classId, status: 'PUBLISHED', createdAt: { gte: since30d } },
              select: { id: true },
            }),
          ])
          const hwIdList = hwIds.map(h => h.id)
          const submitted = hwIdList.length > 0
            ? await prisma.submission.count({
                where: { homeworkId: { in: hwIdList }, status: { not: 'SUBMITTED' } },
              })
            : 0
          const totalPossible = enrolled * hwIdList.length
          return {
            className: ct.class.name,
            submitted,
            enrolled: totalPossible,
          }
        }),
      )

      await sendTeacherDigestEmail({
        to:              teacher.email,
        teacherFirstName: teacher.firstName,
        ungradedCount,
        dueThisWeek:     dueThisWeek.map(hw => ({
          title:     hw.title,
          className: classTeachers.find(ct => ct.classId === hw.classId)?.class.name ?? '',
          dueAt:     hw.dueAt,
        })),
        classStats:      classStats.filter(cs => cs.enrolled > 0),
        baseUrl,
      })

      sent++
    }),
  )

  return NextResponse.json({ ok: true, sent })
}
