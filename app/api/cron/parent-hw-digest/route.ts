import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendParentHwDigestEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'

  const now       = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  // All active parents with at least one child link
  const parents = await prisma.user.findMany({
    where: {
      role:     'PARENT',
      isActive: true,
      email:    { not: '' },
    },
    select: {
      id:        true,
      email:     true,
      firstName: true,
      // Children via ParentStudentLink
      parentLinks: {
        select: {
          child: {
            select: {
              id:         true,
              firstName:  true,
              lastName:   true,
              isActive:   true,
              enrolments: {
                select: { classId: true },
              },
            },
          },
        },
      },
    },
  })

  let sent = 0

  await Promise.allSettled(
    parents.map(async parent => {
      const activeChildren = parent.parentLinks
        .map(l => l.child)
        .filter(c => c.isActive)

      await Promise.allSettled(
        activeChildren.map(async child => {
          const classIds = child.enrolments.map(e => e.classId)
          if (classIds.length === 0) return

          // All published homework for child's classes
          const homework = await prisma.homework.findMany({
            where: { classId: { in: classIds }, status: 'PUBLISHED' },
            select: {
              id:      true,
              title:   true,
              dueAt:   true,
              classId: true,
              class:   { select: { name: true } },
            },
          })

          // Child's existing submissions
          const subHwIds = new Set(
            (await prisma.submission.findMany({
              where: { studentId: child.id, homeworkId: { in: homework.map(h => h.id) } },
              select: { homeworkId: true },
            })).map(s => s.homeworkId),
          )

          // Overdue: dueAt in the past and no submission
          const overdueItems = homework
            .filter(h => h.dueAt && h.dueAt < now && !subHwIds.has(h.id))
            .map(h => ({ title: h.title, className: h.class?.name ?? '', dueAt: h.dueAt }))

          // Due this week: dueAt within current week and no submission
          const dueThisWeek = homework
            .filter(h => h.dueAt && h.dueAt >= weekStart && h.dueAt < weekEnd && !subHwIds.has(h.id))
            .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
            .map(h => ({ title: h.title, className: h.class?.name ?? '', dueAt: h.dueAt }))

          if (overdueItems.length === 0 && dueThisWeek.length === 0) return

          await sendParentHwDigestEmail({
            to:              parent.email,
            parentFirstName: parent.firstName,
            childName:       `${child.firstName} ${child.lastName}`,
            overdueItems,
            dueThisWeek,
            baseUrl,
          })

          sent++
        }),
      )
    }),
  )

  return NextResponse.json({ ok: true, sent })
}
