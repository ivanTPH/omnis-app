import { redirect }  from 'next/navigation'
import { auth }       from '@/lib/auth'
import {
  getMyExams,
  getMyRevisionSessions,
  getRevisionStats,
  getConfidenceProfile,
} from '@/app/actions/revision'
import RevisionDashboard from '@/components/revision/RevisionDashboard'

export default async function RevisionPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  if (user.role !== 'STUDENT') redirect('/student/dashboard')

  const [exams, sessions, stats, confidence] = await Promise.all([
    getMyExams(user.id),
    getMyRevisionSessions(user.id),
    getRevisionStats(user.id),
    getConfidenceProfile(user.id),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-gray-900">Revision Planner</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Plan your revision, track your progress, and build confidence before your exams.
        </p>
      </div>

      <RevisionDashboard
        studentId={user.id}
        initialExams={exams as Parameters<typeof RevisionDashboard>[0]['initialExams']}
        initialSessions={sessions as Parameters<typeof RevisionDashboard>[0]['initialSessions']}
        initialStats={stats}
        initialConfidence={confidence}
      />
    </div>
  )
}
