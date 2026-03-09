import { redirect } from 'next/navigation'
import { auth }     from '@/lib/auth'
import { getOakSyncLogs } from '@/app/actions/platform-admin'
import OakSyncStatus      from '@/components/platform-admin/OakSyncStatus'

export default async function OakSyncPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  if (user.role !== 'PLATFORM_ADMIN') redirect('/dashboard')

  const logs = await getOakSyncLogs()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-gray-900">Oak Content Sync</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Monitor and trigger delta syncs with the Oak National Academy content library.
        </p>
      </div>

      <OakSyncStatus logs={logs as Parameters<typeof OakSyncStatus>[0]['logs']} />
    </div>
  )
}
