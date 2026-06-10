import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { requireAuth } from '@/lib/session'
import { getOptionsOverview } from '@/app/actions/admin'

const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13]

export default async function OptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const params  = await searchParams
  const yearRaw = parseInt(params.year ?? '10', 10)
  const year    = YEAR_GROUPS.includes(yearRaw) ? yearRaw : 10

  const rows = await getOptionsOverview(year)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          title="Subject Options"
          subtitle="Overview of student subject selections by year group"
          backHref="/admin/students"
          backLabel="Students"
        />

        {/* Year tabs */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {YEAR_GROUPS.map(yr => (
            <a
              key={yr}
              href={`/admin/options?year=${yr}`}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                yr === year
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Year {yr}
            </a>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="menu_book"
            title="No subject options recorded"
            description={`No Year ${year} students have subject options set yet. Open a student record and click the book icon to add their subjects.`}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">Subject</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">Type</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-500">Students</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-500">Classes assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.subject} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{r.subject}</td>
                    <td className="px-5 py-3.5">
                      {r.isCore ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          Core
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                          Option
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-700 font-medium">
                      {r.studentCount}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-400">
                      {r.classCount > 0 ? r.classCount : <span className="text-amber-500">None set</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
