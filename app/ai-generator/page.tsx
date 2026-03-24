import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getMyResources, getSchoolResources } from '@/app/actions/ai-generator'
import { getTeacherLessons } from '@/app/actions/homework'
import AiGeneratorShell from '@/components/ai-generator/AiGeneratorShell'
import { ChevronLeft } from 'lucide-react'

const ALLOWED_ROLES = [
  'TEACHER', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT',
]

const ADMIN_ROLES = ['SLT', 'SCHOOL_ADMIN']

export default async function AiGeneratorPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  if (!ALLOWED_ROLES.includes(user.role)) redirect('/dashboard')

  const canViewAll = ADMIN_ROLES.includes(user.role)

  const [myResources, schoolResources, lessonsRaw] = await Promise.all([
    getMyResources(user.schoolId, user.id),
    canViewAll ? getSchoolResources(user.schoolId) : Promise.resolve([]),
    getTeacherLessons(),
  ])

  const userLessons = lessonsRaw.map((l: { id: string; title: string }) => ({
    id:    l.id,
    title: l.title,
  }))

  return (
    <div className="flex flex-col h-full p-6 gap-4 min-h-0">
      {/* Header */}
      <div className="flex-shrink-0">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-600 mb-2 transition-colors"
        >
          <ChevronLeft size={13} /> Back to Calendar
        </Link>
        <h1 className="text-[20px] font-bold text-gray-900">AI Resource Generator</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Generate curriculum-aligned classroom resources in seconds.
        </p>
      </div>

      {/* Shell */}
      <div className="flex-1 min-h-0">
        <AiGeneratorShell
          schoolId={user.schoolId}
          userId={user.id}
          myResources={myResources}
          schoolResources={schoolResources}
          canViewAll={canViewAll}
          userLessons={userLessons}
        />
      </div>
    </div>
  )
}
