import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/session'
import { getMyResources, getSchoolResources } from '@/app/actions/ai-generator'
import { getTeacherLessons } from '@/app/actions/homework'
import AppShell from '@/components/AppShell'
import AiGeneratorShell from '@/components/ai-generator/AiGeneratorShell'
import { PageHeader } from '@/components/ui/PageHeader'

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
  const user = await requireAuth()

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

        <PageHeader
          title="Resource Generator"
          subtitle="Create teaching resources for any topic"
          backHref={backHref}
          backLabel="Back"
        />

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
