import { auth }                    from '@/lib/auth'
import { redirect }                from 'next/navigation'
import AppShell                    from '@/components/AppShell'
import ParentMessagesMonitor       from '@/components/messaging/ParentMessagesMonitor'
import { getAllParentThreads }      from '@/app/actions/messaging'

export default async function ParentMessagesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const threads = await getAllParentThreads()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ParentMessagesMonitor initialThreads={threads} />
      </div>
    </AppShell>
  )
}
