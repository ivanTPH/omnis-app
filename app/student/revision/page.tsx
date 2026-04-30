import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import UnifiedRevisionView from '@/components/revision/UnifiedRevisionView'
import { getMyExams, getMyRevisionSessions, getRevisionStats, getConfidenceProfile } from '@/app/actions/revision'
import { getStudentRevisionTasks } from '@/app/actions/revision-program'

export default async function StudentRevisionPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { id: userId, role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const [exams, sessions, stats, confidence, tasks] = await Promise.all([
    getMyExams(userId).catch(() => []),
    getMyRevisionSessions(userId).catch(() => []),
    getRevisionStats(userId).catch(() => ({
      totalPlanned: 0, totalCompleted: 0, totalSkipped: 0,
      averageConfidence: null, subjectBreakdown: [], streakDays: 0,
    })),
    getConfidenceProfile(userId).catch(() => []),
    getStudentRevisionTasks().catch(() => ({ active: [], completed: [] })),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <UnifiedRevisionView
        studentId={userId}
        initialExams={exams as any}
        initialSessions={sessions as any}
        initialStats={stats as any}
        initialConfidence={confidence as any}
        activeTasks={tasks.active as any}
        completedTasks={tasks.completed as any}
      />
    </AppShell>
  )
}
