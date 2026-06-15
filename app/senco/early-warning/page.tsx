import Link from 'next/link'
import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getEarlyWarningFlags } from '@/app/actions/send-support'
import { getIlpConcernsThisTerm } from '@/app/actions/homework'
import AppShell from '@/components/AppShell'
import EarlyWarningPanel from '@/components/send-support/EarlyWarningPanel'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function EarlyWarningPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT'].includes(role)) redirect('/dashboard')

  const [flags, ilpConcerns] = await Promise.all([
    getEarlyWarningFlags(),
    getIlpConcernsThisTerm(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader
            title="Early Warning System"
            subtitle="AI-detected patterns — review and action"
            action={
              <Link
                href="/api/export/early-warning-report"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="picture_as_pdf" size="sm" />
                Export PDF
              </Link>
            }
          />
        </div>
        {ilpConcerns.length > 0 && (
          <div className="px-6 pb-2">
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="warning" size="sm" className="text-rose-600" />
                <p className="text-[13px] font-bold text-rose-800">ILP Concern Alert</p>
                <span className="ml-auto text-[11px] text-rose-600 font-medium">{ilpConcerns.length} student{ilpConcerns.length !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-[11px] text-rose-700 mb-3">The following students have 3 or more CONCERN entries in their ILP evidence this term:</p>
              <div className="space-y-1.5">
                {ilpConcerns.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-rose-600">{s.firstName[0]}{s.lastName[0]}</span>
                    </div>
                    <Link href={`/send/ilp/${s.id}`} className="text-[12px] font-medium text-rose-800 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                    {s.yearGroup && <span className="text-[11px] text-rose-500">Y{s.yearGroup}</span>}
                    <span className="ml-auto text-[11px] font-bold text-rose-700">{s.concernCount}× CONCERN</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="p-6">
          <EarlyWarningPanel flags={flags} />
        </div>
      </div>
    </AppShell>
  )
}
