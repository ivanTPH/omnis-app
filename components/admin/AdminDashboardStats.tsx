import Icon from '@/components/ui/Icon'
import type { AdminDashboardData } from '@/app/actions/admin'

const STATS = [
  { key: 'studentCount',    label: 'Students',          iconName: 'people',        colour: 'text-blue-600'   },
  { key: 'staffCount',      label: 'Staff',              iconName: 'how_to_reg',    colour: 'text-green-600'  },
  { key: 'classCount',      label: 'Classes',            iconName: 'menu_book',     colour: 'text-gray-900'   },
  { key: 'sendCount',       label: 'On SEND Register',   iconName: 'favorite',      colour: 'text-purple-600' },
  { key: 'pendingHomework', label: 'Awaiting Marking',   iconName: 'assignment',    colour: 'text-amber-600'  },
  { key: 'activeIlpCount',  label: 'Active Plans',       iconName: 'description',   colour: 'text-teal-600'   },
] as const

export default function AdminDashboardStats({ data }: { data: AdminDashboardData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {STATS.map(({ key, label, iconName, colour }) => (
        <div key={key} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name={iconName} size="sm" className={colour} />
            <p className="text-[11px] text-gray-400 font-medium">{label}</p>
          </div>
          <p className={`text-[26px] font-bold ${colour}`}>{data[key]}</p>
        </div>
      ))}
    </div>
  )
}
