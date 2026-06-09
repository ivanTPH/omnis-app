import type { AcademyStats } from '@/app/actions/academy'

type CardProps = { label: string; value: number; colour: string; icon: string }

function StatCard({ label, value, colour, icon }: CardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4">
      <span className={`material-icons text-[28px] ${colour}`}>{icon}</span>
      <div>
        <p className={`text-[28px] font-bold leading-none ${colour}`}>{value.toLocaleString()}</p>
        <p className="text-[12px] text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  )
}

export default function AcademyDashboardStats({ stats }: { stats: AcademyStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard label="Schools"       value={stats.totalSchools}    colour="text-gray-900"   icon="business"     />
      <StatCard label="Students"      value={stats.totalStudents}   colour="text-blue-600"   icon="people"       />
      <StatCard label="Staff"         value={stats.totalStaff}      colour="text-purple-600" icon="badge"        />
      <StatCard label="Published HW"  value={stats.totalHomework}   colour="text-green-600"  icon="assignment"   />
      <StatCard label="Active ILPs"   value={stats.totalActiveIlps} colour="text-amber-600"  icon="description"  />
      <StatCard label="EHCP Plans"    value={stats.totalEhcps}      colour="text-rose-600"   icon="fact_check"   />
    </div>
  )
}
