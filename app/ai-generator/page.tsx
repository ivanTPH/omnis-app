import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getMyResources, getSchoolResources } from '@/app/actions/ai-generator'
import { getTeacherLessons } from '@/app/actions/homework'
import AppShell from '@/components/AppShell'
import AiGeneratorShell from '@/components/ai-generator/AiGeneratorShell'
import { ChevronLeft } from 'lucide-react'

const ALLOWED_ROLES = [
  'TEACHER', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT',
]

const ADMIN_ROLES = ['SLT', 'SCHOOL_ADMIN']

function roleHome(role: string): string {
  switch (role) {
    case 'SENCO':        return '/send/dashboard'
    case 'SLT':          return '/slt/analytics'
    case 'SCHOOL_ADMIN': return '/admin/dashboard'
    default:             return '/dashboard'
  }
}

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

  const backHref = roleHome(user.role)

  return (
    <AppShell
      role={user.role}
      firstName={user.firstName}
      lastName={user.lastName}
      schoolName={user.schoolName}
    >
      <div className="flex flex-col h-full p-6 gap-4 min-h-0">

        {/* Header — matches the icon-button breadcrumb pattern used across the app */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href={backHref}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            title="Back"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 leading-tight">AI Resource Generator</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">Generate curriculum-aligned classroom resources in seconds.</p>
          </div>
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
    </AppShell>
  )
}
