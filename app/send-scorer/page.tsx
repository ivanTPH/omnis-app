import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getOakSubjects } from '@/app/actions/oak'
import ScorerView from '@/components/send/ScorerView'

export default async function SendScorerPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const allSubjects = await getOakSubjects()
  const subjects = allSubjects.map(s => ({ slug: s.slug, title: s.title }))

  const canRescore = ['SLT', 'SCHOOL_ADMIN'].includes(role)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-gray-900">Resource Quality Scorer</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Score Oak National Academy lessons for SEND accessibility using AI
            </p>
          </div>
          <ScorerView canRescore={canRescore} initialSubjects={subjects} />
        </div>
      </main>
    </AppShell>
  )
}
