import { redirect }              from 'next/navigation'
import { requireAuth }           from '@/lib/session'
import { getCommunicationLog }   from '@/app/actions/communications'
import AppShell                  from '@/components/AppShell'
import CommunicationsView        from './CommunicationsView'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO', 'HEAD_OF_DEPT']

export const metadata = { title: 'Communications — Omnis' }

export default async function AdminCommunicationsPage() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) redirect('/dashboard')

  const log = await getCommunicationLog()

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <CommunicationsView log={log} />
    </AppShell>
  )
}
