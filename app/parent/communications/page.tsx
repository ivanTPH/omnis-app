import { requireAuth }                from '@/lib/session'
import AppShell                       from '@/components/AppShell'
import ParentCommunicationsClient     from './ParentCommunicationsClient'

export const metadata = { title: 'School Messages — Omnis' }

export default async function ParentCommunicationsPage() {
  const user = await requireAuth('PARENT')
  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <ParentCommunicationsClient />
    </AppShell>
  )
}
