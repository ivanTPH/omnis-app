import { redirect }              from 'next/navigation'
import { requireAuth }           from '@/lib/session'
import { getSafeguardingLog }    from '@/app/actions/safeguarding'
import AppShell                  from '@/components/AppShell'
import SafeguardingView          from './SafeguardingView'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO']

export const metadata = { title: 'Safeguarding — Omnis' }

export default async function SafeguardingPage() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) redirect('/dashboard')

  const log = await getSafeguardingLog()

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <SafeguardingView log={log} />
    </AppShell>
  )
}
