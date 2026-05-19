import { auth }     from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell    from '@/components/AppShell'
import TaNotesHub  from '@/components/TaNotesHub'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function TaNotesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'TEACHING_ASSISTANT') redirect('/dashboard')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 px-6 pt-5 pb-3 bg-white border-b border-gray-200">
          <PageHeader
            title="Student Notes"
            subtitle="Add and review TA notes across your classes"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden bg-gray-50">
          <TaNotesHub />
        </div>
      </div>
    </AppShell>
  )
}
