import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getPlatformStats, getPlatformUsageStats, getAuditLog, getSchoolHealthData } from '@/app/actions/platform-admin'
import PlatformDashboardStats from '@/components/platform-admin/PlatformDashboardStats'
import PlatformUsageChart from '@/components/platform-admin/PlatformUsageChart'
import PlatformAuditLogTable from '@/components/platform-admin/PlatformAuditLogTable'
import PlatformSchoolHealthTable from '@/components/platform-admin/PlatformSchoolHealthTable'
import PlatformInsightsPanel from '@/components/platform-admin/PlatformInsightsPanel'
import OmnisInferenceStatsPanel from '@/components/platform-admin/OmnisInferenceStatsPanel'
import AttainmentBenchmarkPanel from '@/components/platform-admin/AttainmentBenchmarkPanel'
import { getAllAttainmentBenchmarks } from '@/app/actions/attainment-benchmark'

export default async function PlatformDashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'PLATFORM_ADMIN') redirect('/dashboard')

  const [stats, usageStats, auditLog, healthRows, benchmarks] = await Promise.all([
    getPlatformStats(),
    getPlatformUsageStats(),
    getAuditLog(50),
    getSchoolHealthData(),
    getAllAttainmentBenchmarks(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Platform Dashboard</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Omnis platform overview — all schools</p>
          </div>
          <PlatformDashboardStats data={stats} />
          <PlatformInsightsPanel />
          <AttainmentBenchmarkPanel bySchool={benchmarks.bySchool} network={benchmarks.network} />
          <OmnisInferenceStatsPanel />
          <PlatformUsageChart data={usageStats} />
          <PlatformSchoolHealthTable rows={healthRows} />
          <PlatformAuditLogTable logs={auditLog} />
        </div>
      </main>
    </AppShell>
  )
}
