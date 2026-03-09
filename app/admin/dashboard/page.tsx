import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { getAdminDashboardData } from '@/app/actions/admin'
import AdminDashboardStats from '@/components/admin/AdminDashboardStats'
import {
  UserCheck, Users, BookOpen, Clock, Calendar, BarChart2,
  Shield, MessageSquare,
} from 'lucide-react'

const QUICK_LINKS = [
  { label: 'Staff',      href: '/admin/staff',     icon: UserCheck,    desc: 'View all staff members'      },
  { label: 'Students',   href: '/admin/students',  icon: Users,        desc: 'Browse students by year'     },
  { label: 'Classes',    href: '/admin/classes',   icon: BookOpen,     desc: 'Classes & assignments'       },
  { label: 'Timetable',  href: '/admin/timetable', icon: Clock,        desc: 'Weekly timetable grid'       },
  { label: 'Calendar',   href: '/admin/calendar',  icon: Calendar,     desc: 'Term dates & holidays'       },
  { label: 'Analytics',  href: '/slt/analytics',   icon: BarChart2,    desc: 'School performance data'     },
  { label: 'Audit Log',  href: '/admin/audit',     icon: Shield,       desc: 'Immutable event log'         },
  { label: 'Messages',   href: '/messages',        icon: MessageSquare,desc: 'Staff messaging inbox'       },
]

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const data = await getAdminDashboardData(schoolId)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[22px] font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              School-wide overview — {schoolName}
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8">
            <AdminDashboardStats data={data} />
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Quick Access
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {QUICK_LINKS.map(({ label, href, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm hover:border-blue-200 transition group"
                >
                  <Icon size={20} className="text-blue-600 mb-3" />
                  <p className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700">
                    {label}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
