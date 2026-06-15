import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOverdueMarkingEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 5)

  // Find submissions that have been in SUBMITTED status for 5+ days
  const overdueSubmissions = await prisma.submission.findMany({
    where: {
      status:      'SUBMITTED',
      submittedAt: { lte: cutoff },
    },
    select: {
      submittedAt: true,
      student:     { select: { firstName: true, lastName: true } },
      homework: {
        select: {
          id:    true,
          title: true,
          class: {
            select: {
              name:    true,
              teachers: {
                select: { user: { select: { id: true, email: true, firstName: true } } },
              },
            },
          },
        },
      },
    },
    take: 500,
  })

  // Group by teacher
  type TeacherItem = {
    email:     string
    firstName: string
    items: Array<{ homeworkTitle: string; className: string; studentName: string; daysPending: number; homeworkId: string }>
  }
  const teacherMap = new Map<string, TeacherItem>()

  const now = Date.now()
  for (const sub of overdueSubmissions) {
    const daysPending = Math.floor((now - sub.submittedAt.getTime()) / 86_400_000)
    const teachers    = sub.homework.class?.teachers ?? []
    for (const ct of teachers) {
      const { id, email, firstName } = ct.user
      if (!teacherMap.has(id)) teacherMap.set(id, { email, firstName, items: [] })
      teacherMap.get(id)!.items.push({
        homeworkTitle: sub.homework.title,
        className:     sub.homework.class?.name ?? '—',
        studentName:   `${sub.student.firstName} ${sub.student.lastName}`,
        daysPending,
        homeworkId:    sub.homework.id,
      })
    }
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'
  let sent = 0

  await Promise.allSettled(
    [...teacherMap.entries()].map(async ([, teacher]) => {
      // Sort by days pending descending, cap at 20 rows
      const sorted = teacher.items
        .sort((a, b) => b.daysPending - a.daysPending)
        .slice(0, 20)

      await sendOverdueMarkingEmail({
        to:               teacher.email,
        teacherFirstName: teacher.firstName,
        items:            sorted,
        markingUrl:       `${baseUrl}/homework`,
      })
      sent++
    }),
  )

  return NextResponse.json({ ok: true, sent })
}
