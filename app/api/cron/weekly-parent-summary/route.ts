import { NextRequest, NextResponse }        from 'next/server'
import { prisma }                           from '@/lib/prisma'
import { sendWeeklyParentSummaryEmail }     from '@/lib/email'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = new Date()
  const ago14  = new Date(now.getTime() - 14 * 86_400_000)

  // All parent-student links with parent emails
  const links = await prisma.parentStudentLink.findMany({
    select: {
      parent: { select: { id: true, firstName: true, email: true, schoolId: true } },
      child:  { select: { id: true, firstName: true, lastName: true, yearGroup: true, attendancePercentage: true } },
    },
  })

  if (links.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No parent links found' })
  }

  // Get school names
  const schoolIds = [...new Set(links.map(l => l.parent.schoolId))].filter(Boolean) as string[]
  const schools = await prisma.school.findMany({
    where:  { id: { in: schoolIds } },
    select: { id: true, name: true },
  })
  const schoolMap = new Map(schools.map(s => [s.id, s.name]))

  // For each child, get recent graded submissions (last 14 days) + overdue homework count
  const childIds = [...new Set(links.map(l => l.child.id))]

  const [submissions, homeworkData] = await Promise.all([
    prisma.submission.findMany({
      where:    { studentId: { in: childIds }, status: 'RETURNED', markedAt: { gte: ago14 } },
      select:   {
        studentId:   true,
        finalScore:  true,
        teacherScore: true,
        homework:    { select: { title: true, class: { select: { subject: true } } } },
      },
      orderBy:  { markedAt: 'desc' },
    }),
    prisma.homework.findMany({
      where: {
        class:  { enrolments: { some: { userId: { in: childIds } } } },
        status: 'PUBLISHED',
        dueAt:  { lt: now },
      },
      select: {
        id:    true,
        class: { select: { enrolments: { select: { userId: true } } } },
        submissions: { where: { studentId: { in: childIds } }, select: { studentId: true } },
      },
    }),
  ])

  // Overdue = published, past due, no submission
  const overdueByStudent = new Map<string, number>()
  for (const hw of homeworkData) {
    const enrolled = new Set(hw.class.enrolments.map(e => e.userId))
    const submitted = new Set(hw.submissions.map(s => s.studentId))
    for (const sid of enrolled) {
      if (!submitted.has(sid)) {
        overdueByStudent.set(sid, (overdueByStudent.get(sid) ?? 0) + 1)
      }
    }
  }

  function scoreToGrade(score: number | null): string {
    if (score == null) return '—'
    const pct = score > 9 ? score : score * 100 / 9
    if (pct >= 95) return '9'
    if (pct >= 85) return '8'
    if (pct >= 75) return '7'
    if (pct >= 65) return '6'
    if (pct >= 55) return '5'
    if (pct >= 45) return '4'
    if (pct >= 35) return '3'
    if (pct >= 25) return '2'
    return '1'
  }

  // Group submissions by studentId
  const subsByStudent = new Map<string, typeof submissions>()
  for (const s of submissions) {
    if (!subsByStudent.has(s.studentId)) subsByStudent.set(s.studentId, [])
    subsByStudent.get(s.studentId)!.push(s)
  }

  let sent   = 0
  const errors: string[] = []

  for (const link of links) {
    try {
      const childSubs   = subsByStudent.get(link.child.id) ?? []
      const overdue     = overdueByStudent.get(link.child.id) ?? 0
      const schoolName  = schoolMap.get(link.parent.schoolId ?? '') ?? 'Your school'

      const recentGrades = childSubs.slice(0, 6).map(s => ({
        title:   s.homework.title,
        subject: s.homework.class?.subject ?? 'Unknown',
        grade:   scoreToGrade(s.finalScore ?? s.teacherScore),
      }))

      await sendWeeklyParentSummaryEmail({
        to:              link.parent.email,
        parentFirstName: link.parent.firstName,
        childName:       `${link.child.firstName} ${link.child.lastName}`,
        schoolName,
        attendancePct:   link.child.attendancePercentage,
        recentGrades,
        overdueCount:    overdue,
      })

      sent++
    } catch (err) {
      errors.push(`parentId ${link.parent.id}: ${String(err)}`)
    }
  }

  return NextResponse.json({
    ok:     errors.length === 0,
    sent,
    total:  links.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
