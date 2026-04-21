import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { percentToGcseGrade } from '@/lib/grading'
import { getUnreadMessageCount } from '@/app/actions/messaging'
import { getStudentOwnPassport } from '@/app/actions/students'
import StudentMobileDashboard, { type MobileHw, type SubjectProgress } from '@/components/StudentMobileDashboard'

export default async function StudentDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, avatarUrl, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const enrolments = await prisma.enrolment.findMany({ where: { userId }, select: { classId: true } })
  const classIds = enrolments.map((e: any) => e.classId)

  const allHw = await prisma.homework.findMany({
    where: {
      schoolId,
      classId: { in: classIds },
      status: 'PUBLISHED',
      OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: userId }],
    },
    include: {
      class: { select: { name: true, subject: true } },
      submissions: {
        where: { studentId: userId },
        select: { id: true, status: true, grade: true, finalScore: true, submittedAt: true, homework: { select: { gradingBands: true } } },
      },
    },
    orderBy: { dueAt: 'asc' },
  })

  // Prefer adapted version for same lesson
  const map = new Map<string, any>()
  for (const hw of allHw) {
    const key = hw.lessonId ?? hw.id
    if (hw.isAdapted || !map.has(key)) map.set(key, hw)
  }
  const homework = Array.from(map.values())

  const now   = new Date()
  const soon  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)  // 3 days

  // ── Build MobileHw array ────────────────────────────────────────────────────

  const mobileHw: MobileHw[] = homework.map((hw: any) => {
    const sub    = hw.submissions[0] ?? null
    const dueAt  = new Date(hw.dueAt)
    let status: MobileHw['status']
    if (sub?.grade)                           status = 'graded'
    else if (sub)                             status = 'submitted'
    else if (dueAt < now)                     status = 'overdue'
    else if (dueAt <= soon)                   status = 'due_soon'
    else                                      status = 'upcoming'

    // Normalise score to 0–100 percent
    let score: number | null = null
    if (sub?.finalScore != null) {
      const bands = sub.homework?.gradingBands
      const max   = bands && typeof bands === 'object'
        ? Math.max(0, ...Object.keys(bands as Record<string,string>).flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n))))
        : 9
      score = max > 0 ? Math.min(100, Math.round((sub.finalScore / max) * 100)) : null
    }

    return {
      id:        hw.id,
      title:     hw.title,
      dueAt:     hw.dueAt.toISOString(),
      subject:   hw.class.subject,
      className: hw.class.name,
      status,
      grade:     sub?.grade ?? null,
      score,
    }
  })

  // ── Subject progress (from graded homework) ─────────────────────────────────

  const subjectScores = new Map<string, number[]>()
  for (const hw of mobileHw) {
    if (hw.score != null) {
      if (!subjectScores.has(hw.subject)) subjectScores.set(hw.subject, [])
      subjectScores.get(hw.subject)!.push(hw.score)
    }
  }

  const subjectProgress: SubjectProgress[] = Array.from(subjectScores.entries())
    .map(([subject, scores]) => {
      const avg   = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      const grade = percentToGcseGrade(avg)
      return { subject, avgScore: avg, grade, count: scores.length }
    })
    .sort((a, b) => b.avgScore - a.avgScore)

  // ── Unread message count ────────────────────────────────────────────────────

  let unreadCount = 0
  try { unreadCount = await getUnreadMessageCount() } catch {}

  let passport = null
  try { passport = await getStudentOwnPassport() } catch {}

  return (
    <StudentMobileDashboard
      firstName={firstName}
      lastName={lastName}
      avatarUrl={avatarUrl ?? null}
      schoolName={schoolName}
      homework={mobileHw}
      subjectProgress={subjectProgress}
      unreadCount={unreadCount}
      passport={passport}
    />
  )
}
