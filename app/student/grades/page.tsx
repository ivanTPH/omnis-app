import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'

export default async function StudentGradesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
            <Icon name="construction" size="lg" className="text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Grades</h1>
          <p className="text-gray-500 mb-1">Your grade history across all subjects — coming soon.</p>
          <p className="text-sm text-gray-400">Check your homework submissions for individual grades in the meantime.</p>
        </div>
      </div>
    </AppShell>
  )
}
