import { requireAuth }      from '@/lib/session'
import { redirect }          from 'next/navigation'
import AppShell              from '@/components/AppShell'
import Link                  from 'next/link'
import Icon                  from '@/components/ui/Icon'
import { getHoyWelfareData } from '@/app/actions/hoy-welfare'
import HoyWelfarePanel       from '@/components/hoy/HoyWelfarePanel'

export const dynamic = 'force-dynamic'

export default async function HoyWelfarePage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['HEAD_OF_YEAR', 'SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const data = await getHoyWelfareData()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/hoy/analytics" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Icon name="chevron_left" size="sm" /> Analytics
                </Link>
              </div>
              <h1 className="text-[22px] font-bold text-gray-900">Pastoral Welfare</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {schoolName}
                {data.yearGroup ? ` — Year ${data.yearGroup}` : ''} · {data.totalStudents} students
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/api/export/welfare-report"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="download" size="sm" />
                Export PDF
              </Link>
              <div className="flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 bg-rose-50 text-rose-700 rounded-full border border-rose-100">
                <Icon name="favorite" size="sm" />
                Pastoral overview
              </div>
            </div>
          </div>

          <HoyWelfarePanel data={data} />

        </div>
      </main>
    </AppShell>
  )
}
