import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import NotificationsView from '@/components/NotificationsView'
import { getMyPlatformNotifications } from '@/app/actions/messaging'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  let notifications: Awaited<ReturnType<typeof getMyPlatformNotifications>> = []
  try {
    notifications = await getMyPlatformNotifications()
  } catch (err) {
    console.error('[NotificationsPage] fetch failed:', err)
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <NotificationsView notifications={notifications} />
    </AppShell>
  )
}
