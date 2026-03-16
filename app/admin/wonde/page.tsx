import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import WondeSyncPanel from '@/components/admin/WondeSyncPanel'
import { getWondeConfig, getWondeSyncLogs, getWondeCounts } from '@/app/actions/wonde'

export default async function WondeSyncPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const [config, logs, counts] = await Promise.all([
    getWondeConfig(),
    getWondeSyncLogs(20),
    getWondeCounts(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-gray-900">MIS Sync (Wonde)</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Sync staff, students and timetable data from your MIS via Wonde
            </p>
          </div>
          <WondeSyncPanel config={config} counts={counts} logs={logs} />
        </div>
      </main>
    </AppShell>
  )
}
