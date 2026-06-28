import { requireAuth } from '@/lib/session'
import { redirect }   from 'next/navigation'
import Link           from 'next/link'
import AppShell       from '@/components/AppShell'
import Icon           from '@/components/ui/Icon'
import ExportPdfButton from '@/components/ExportPdfButton'
import { prisma }     from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ParentReportPage() {
  const { id: parentId, role, firstName, lastName, schoolName, schoolId } = await requireAuth()
  if (role !== 'PARENT') redirect('/dashboard')

  // Get linked children
  const links = await prisma.parentStudentLink.findMany({
    where:  { parentId },
    select: {
      child: {
        select: {
          id: true, firstName: true, lastName: true,
          yearGroup: true, tutorGroup: true,
          attendancePercentage: true,
          schoolId: true,
        },
      },
    },
  })

  const children = links
    .map(l => l.child)
    .filter(c => c.schoolId === schoolId)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/parent/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Dashboard
            </Link>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-1">Progress Reports</h1>
          <p className="text-[13px] text-gray-400 mb-6">
            Download a PDF summary report for your child including recent grades, attendance and learning targets.
          </p>

          {children.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
              <Icon name="person" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No linked children found.</p>
              <p className="text-[12px] text-gray-400 mt-1">Please contact your school to set up your account link.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map(child => {
                const attPct = child.attendancePercentage
                const attColor = attPct == null ? 'text-gray-400'
                  : attPct < 85 ? 'text-rose-600'
                  : attPct < 90 ? 'text-amber-600'
                  : 'text-emerald-600'

                return (
                  <div key={child.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
                    {/* Initials avatar */}
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-[15px] font-bold shrink-0">
                      {child.firstName[0]}{child.lastName[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {child.yearGroup && (
                          <span className="text-[11px] text-gray-500">Year {child.yearGroup}</span>
                        )}
                        {child.tutorGroup && (
                          <span className="text-[11px] text-gray-500">Form {child.tutorGroup}</span>
                        )}
                        {attPct != null && (
                          <span className={`text-[11px] font-semibold ${attColor}`}>
                            {attPct.toFixed(1)}% attendance
                          </span>
                        )}
                      </div>
                    </div>

                    <ExportPdfButton
                      href={`/api/export/parent-report/${child.id}`}
                      filename={`${child.firstName}-${child.lastName}-report.pdf`}
                      label="Download PDF"
                    />
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-6 text-center">
            Reports are generated in real-time from school data. Content set by {schoolName}.
          </p>
        </div>
      </main>
    </AppShell>
  )
}
