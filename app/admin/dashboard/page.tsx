import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { getAdminDashboardData, getSchoolSettings, getActivationBreakdown, type AdminDashboardData } from '@/app/actions/admin'
import AdminDashboardStats from '@/components/admin/AdminDashboardStats'
import YearRolloverPanel from '@/components/admin/YearRolloverPanel'
import ActivationPanel from '@/components/admin/ActivationPanel'
import Icon from '@/components/ui/Icon'

const QUICK_LINKS = [
  { label: 'All Users',         href: '/admin/users',     iconName: 'manage_accounts', desc: 'Users, roles & activation'   },
  { label: 'Staff',             href: '/admin/staff',     iconName: 'how_to_reg',    desc: 'View all staff members'      },
  { label: 'Students',          href: '/admin/students',  iconName: 'people',        desc: 'Browse students by year'     },
  { label: 'Classes',           href: '/admin/classes',   iconName: 'menu_book',     desc: 'Classes & assignments'       },
  { label: 'Subjects & Boards', href: '/admin/subjects',  iconName: 'school',        desc: 'Set exam boards per subject' },
  { label: 'Timetable',  href: '/admin/timetable', iconName: 'schedule',      desc: 'Weekly timetable grid'       },
  { label: 'Calendar',   href: '/admin/calendar',  iconName: 'calendar_today',desc: 'Term dates & holidays'       },
  { label: 'Analytics',  href: '/slt/analytics',   iconName: 'bar_chart',     desc: 'School performance data'     },
  { label: 'Audit Log',  href: '/admin/audit',     iconName: 'shield',        desc: 'Immutable event log'         },
  { label: 'MIS Sync',   href: '/admin/wonde',     iconName: 'refresh',       desc: 'Sync data from Wonde MIS'    },
  { label: 'Messages',        href: '/messages',        iconName: 'chat',              desc: 'Staff messaging inbox'       },
  { label: 'Parent Messages', href: '/admin/messages',  iconName: 'supervisor_account', desc: 'Monitor parent conversations' },
]

export default async function AdminDashboardPage() {
  const { schoolId, role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const [data, settings, activationBreakdown] = await Promise.all([
    getAdminDashboardData(schoolId).catch(() =>
      ({ studentCount: 0, staffCount: 0, classCount: 0, sendCount: 0, pendingHomework: 0, activeIlpCount: 0, pendingActivation: 0 }) as AdminDashboardData
    ),
    getSchoolSettings().catch(() => null),
    getActivationBreakdown().catch(() => []),
  ])

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

          {/* Onboarding banner */}
          {settings && !settings.onboardedAt && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Icon name="info" size="md" className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-amber-900">Complete your school setup</p>
                <p className="text-[12px] text-amber-700 mt-0.5">
                  Finish the onboarding checklist to configure your school profile, invite staff, and connect your MIS.
                </p>
              </div>
              <Link
                href="/admin/onboarding"
                className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-medium rounded-lg transition"
              >
                Start setup
              </Link>
            </div>
          )}

          {/* Stats */}
          <div className="mb-8">
            <AdminDashboardStats data={data} />
          </div>

          {/* Activation panel */}
          {data.pendingActivation > 0 && (
            <div className="mb-8">
              <ActivationPanel
                breakdown={activationBreakdown}
                total={data.studentCount}
                pending={data.pendingActivation}
              />
            </div>
          )}

          {/* Year rollover */}
          <div className="mb-8">
            <YearRolloverPanel />
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Quick Access
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {QUICK_LINKS.map(({ label, href, iconName, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm hover:border-blue-200 transition group"
                >
                  <Icon name={iconName} size="md" className="text-blue-600 mb-3" />
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
