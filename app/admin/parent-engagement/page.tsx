import { requireAuth }            from '@/lib/session'
import { redirect }               from 'next/navigation'
import AppShell                   from '@/components/AppShell'
import { getParentEngagementData } from '@/app/actions/admin'
import ParentEngagementView       from './ParentEngagementView'

export const dynamic = 'force-dynamic'

export default async function ParentEngagementPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const rows = await getParentEngagementData()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <ParentEngagementView rows={rows} />
    </AppShell>
  )
}
