import type { PlatformStats } from '@/app/actions/platform-admin'

type StatCardProps = { label: string; value: number; colour: string }

function StatCard({ label, value, colour }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className={`text-[28px] font-bold ${colour}`}>{value.toLocaleString()}</p>
      <p className="text-[12px] text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function PlatformDashboardStats({ data }: { data: PlatformStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
      <StatCard label="Total Schools"     value={data.totalSchools}       colour="text-gray-900"    />
      <StatCard label="Active Schools"    value={data.activeSchools}      colour="text-green-600"   />
      <StatCard label="Total Students"    value={data.totalStudents}      colour="text-blue-600"    />
      <StatCard label="Total Staff"       value={data.totalStaff}         colour="text-purple-600"  />
      <StatCard label="Oak Lessons"       value={data.totalOakLessons}    colour="text-amber-600"   />
      <StatCard label="SEND Scores"       value={data.totalSendScores}    colour="text-rose-600"    />
      <StatCard label="Consent Records"   value={data.totalConsentRecords} colour="text-teal-600"   />
    </div>
  )
}
