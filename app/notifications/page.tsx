import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import NotificationsView from '@/components/NotificationsView'
import { getMyPlatformNotifications } from '@/app/actions/messaging'

export default async function NotificationsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

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
