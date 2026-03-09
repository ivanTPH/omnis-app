import { Users, UserCheck, BookOpen, Heart, ClipboardList, FileText } from 'lucide-react'
import type { AdminDashboardData } from '@/app/actions/admin'

const STATS = [
  { key: 'studentCount',    label: 'Students',          icon: Users,         colour: 'text-blue-600'   },
  { key: 'staffCount',      label: 'Staff',              icon: UserCheck,     colour: 'text-green-600'  },
  { key: 'classCount',      label: 'Classes',            icon: BookOpen,      colour: 'text-gray-900'   },
  { key: 'sendCount',       label: 'On SEND Register',   icon: Heart,         colour: 'text-purple-600' },
  { key: 'pendingHomework', label: 'Awaiting Marking',   icon: ClipboardList, colour: 'text-amber-600'  },
  { key: 'activeIlpCount',  label: 'Active Plans',       icon: FileText,      colour: 'text-teal-600'   },
] as const

export default function AdminDashboardStats({ data }: { data: AdminDashboardData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {STATS.map(({ key, label, icon: Icon, colour }) => (
        <div key={key} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon size={13} className={colour} />
            <p className="text-[11px] text-gray-400 font-medium">{label}</p>
          </div>
          <p className={`text-[26px] font-bold ${colour}`}>{data[key]}</p>
        </div>
      ))}
    </div>
  )
}
