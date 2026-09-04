import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import Icon from '@/components/ui/Icon'
import StudentSearch from '@/components/StudentSearch'
import { STAFF_ROLES } from '@/lib/staffRoles'

type ReportCard = { label: string; href: string; icon: string; desc: string }

// Mirrors the "Reporting" section pulled out in each role's navByRole array in
// Sidebar.tsx — same hrefs, same icons. Kept in sync manually since these are
// existing, already-reviewed routes, not new ones.
const ROLE_DESTINATIONS: Record<string, ReportCard[]> = {
  HEAD_OF_DEPT: [
    { label: 'Classes & Analytics', href: '/analytics',            icon: 'groups',        desc: 'Class and student performance across your department' },
    { label: 'Teacher Analytics',   href: '/analytics/teacher',     icon: 'person_search', desc: 'Per-teacher grade, submission, and turnaround comparison' },
    { label: 'Dept Analytics',      href: '/analytics/department',  icon: 'domain',        desc: "Department-wide attainment and Bloom's coverage" },
  ],
  HEAD_OF_YEAR: [
    { label: 'Classes & Analytics', href: '/analytics',                icon: 'groups',    desc: 'Class and student performance across the year group' },
    { label: 'Year Analytics',      href: '/hoy/analytics',            icon: 'bar_chart', desc: 'Year-group attainment, attendance, and pastoral trends' },
    { label: 'Inclusion Report',    href: '/senco/inclusion-report',   icon: 'summarize', desc: 'SEND provision evidence — register, ILP/EHCP coverage, progress' },
  ],
  SENCO: [
    { label: 'Analytics',        href: '/analytics',               icon: 'analytics',   desc: 'Class and student performance across the school' },
    { label: 'SEND Analytics',   href: '/senco/analytics',         icon: 'query_stats', desc: 'SEND-specific attainment and adaptive learning data' },
    { label: 'Inclusion Report', href: '/senco/inclusion-report',  icon: 'summarize',   desc: 'SEND provision evidence — register, ILP/EHCP coverage, progress' },
  ],
  SCHOOL_ADMIN: [
    { label: 'Analytics',        href: '/slt/analytics',          icon: 'bar_chart', desc: 'School-wide performance and attainment analytics' },
    { label: 'Inclusion Report', href: '/senco/inclusion-report', icon: 'summarize', desc: 'SEND provision evidence — register, ILP/EHCP coverage, progress' },
  ],
  SLT: [
    { label: 'Analytics',         href: '/slt/analytics',          icon: 'bar_chart',     desc: 'School-wide performance and attainment analytics' },
    { label: 'Teacher Analytics', href: '/analytics/teacher',      icon: 'person_search', desc: 'Per-teacher grade, submission, and turnaround comparison' },
    { label: 'Dept Analytics',    href: '/analytics/department',   icon: 'domain',        desc: "Department-wide attainment and Bloom's coverage" },
    { label: 'Inclusion Report',  href: '/senco/inclusion-report', icon: 'summarize',     desc: 'SEND provision evidence — register, ILP/EHCP coverage, progress' },
  ],
}

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!STAFF_ROLES.has(role)) redirect('/dashboard')

  const destinations = ROLE_DESTINATIONS[role] ?? []

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <PageHeader
            title="Reporting"
            subtitle="Analytics, SEND inclusion evidence, and per-student report exports — all in one place."
            backHref="/dashboard"
            backLabel="Dashboard"
          />

          {destinations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Analytics &amp; Evidence Reports
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {destinations.map(d => (
                  <a
                    key={d.href}
                    href={d.href}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm hover:border-blue-200 transition group flex items-start gap-3"
                  >
                    <Icon name={d.icon} size="md" className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700">
                        {d.label}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{d.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Generate a Student Report
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[12px] text-gray-500 mb-3">
                Search for a student to open their file, then use the Report Card or Narrative Report
                buttons in the header to export a PDF.
              </p>
              <StudentSearch role={role} />
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
