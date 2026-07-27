import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import { getSignupDashboard } from '@/app/actions/signups'
import SignupsDashboard from './SignupsDashboard'

export const metadata = { title: 'Beta Signups — Omnis' }

export default async function SignupsPage() {
  const user = await requireAuth('PLATFORM_ADMIN')
  const data = await getSignupDashboard()

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <SignupsDashboard data={data} />
    </AppShell>
  )
}
