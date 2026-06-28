import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import SendBadge from '@/components/ui/SendBadge'
import { getAllAPDRCycles } from '@/app/actions/send-support'

export const dynamic = 'force-dynamic'

const APDR_STEPS = ['Assess', 'Plan', 'Do', 'Review'] as const

function CycleStepBadge({ cycleStatus, approvedBySenco }: { cycleStatus: string; approvedBySenco: boolean }) {
  const isCompleted = cycleStatus === 'COMPLETED'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
      isCompleted ? 'bg-gray-100 text-gray-500' :
      approvedBySenco ? 'bg-emerald-100 text-emerald-700' :
      'bg-amber-100 text-amber-700'
    }`}>
      <Icon name={isCompleted ? 'check_circle' : approvedBySenco ? 'verified' : 'pending'} size="sm" />
      {isCompleted ? 'Completed' : approvedBySenco ? 'Approved' : 'Pending approval'}
    </span>
  )
}

function ReviewDueBadge({ reviewDate }: { reviewDate: Date }) {
  const now    = Date.now()
  const due    = new Date(reviewDate).getTime()
  const days   = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  const urgent = days <= 7
  const warn   = days <= 21
  return (
    <span className={`text-[11px] font-medium ${urgent ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-500'}`}>
      {urgent && <Icon name="warning" size="sm" className="inline mr-0.5" />}
      {new Date(reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      {days <= 0 ? ' (overdue)' : days <= 7 ? ` (${days}d)` : ''}
    </span>
  )
}

export default async function ApdrOverviewPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const cycles = await getAllAPDRCycles()
  const active    = cycles.filter(c => c.status === 'ACTIVE')
  const completed = cycles.filter(c => c.status === 'COMPLETED')

  // Stats
  const totalActive    = active.length
  const pendingApproval = active.filter(c => !c.approvedBySenco).length
  const reviewDue14    = active.filter(c => {
    const days = Math.ceil((new Date(c.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days <= 14
  }).length

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <PageHeader
            title="APDR Cycles"
            subtitle="Assess · Plan · Do · Review — statutory SEND review cycle tracking"
            backHref="/senco/ilp"
            backLabel="ILP Records"
          />

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mt-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Active cycles</p>
              <p className="text-3xl font-bold text-gray-900">{totalActive}</p>
            </div>
            <div className={`border rounded-xl px-5 py-4 ${pendingApproval > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Pending approval</p>
              <p className={`text-3xl font-bold ${pendingApproval > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{pendingApproval}</p>
            </div>
            <div className={`border rounded-xl px-5 py-4 ${reviewDue14 > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Reviews due ≤14d</p>
              <p className={`text-3xl font-bold ${reviewDue14 > 0 ? 'text-red-600' : 'text-gray-900'}`}>{reviewDue14}</p>
            </div>
          </div>

          {/* APDR cycle steps legend */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 mb-6 flex items-center gap-8">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">Phase guide</span>
            {APDR_STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">{i + 1}</div>
                <span className="text-[11px] font-medium text-gray-700">{label}</span>
                {i === 0 && <span className="text-[10px] text-gray-400">— concerns/data gathered</span>}
                {i === 1 && <span className="text-[10px] text-gray-400">— targets set, ILP drafted</span>}
                {i === 2 && <span className="text-[10px] text-gray-400">— interventions running</span>}
                {i === 3 && <span className="text-[10px] text-gray-400">— cycle closed, next started</span>}
              </div>
            ))}
          </div>

          {/* Active cycles table */}
          {active.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <Icon name="loop" size="sm" className="text-blue-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">Active cycles</h2>
                <span className="ml-auto text-[11px] text-gray-400">{active.length} students</span>
              </div>
              <div className="divide-y divide-gray-100">
                {active.map(c => (
                  <Link key={c.id} href={`/students/${c.studentId}?tab=APDR`} className="flex items-center gap-4 px-5 py-3 hover:bg-blue-50 transition-colors group">
                    {/* Student */}
                    <div className="w-44 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{c.studentName}</p>
                        {c.sendStatus !== 'NONE' && (
                          <SendBadge status={c.sendStatus as 'EHCP' | 'SEN_SUPPORT'} showTier />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {c.yearGroup ? `Year ${c.yearGroup}` : '—'}
                        {c.sendCategory ? ` · ${c.sendCategory}` : ''}
                      </p>
                    </div>

                    {/* APDR mini-stepper */}
                    <div className="flex items-center gap-0 shrink-0">
                      {APDR_STEPS.map((label, i) => {
                        // Active cycles are in "Do" phase (index 2); Assess(0) + Plan(1) complete
                        const current = 2
                        const isComp  = i < current
                        const isCurr  = i === current
                        return (
                          <div key={label} className="flex items-center">
                            {i > 0 && <div className={`h-px w-4 ${isComp ? 'bg-green-400' : isCurr ? 'bg-blue-300' : 'bg-gray-200'}`} />}
                            <div className="flex flex-col items-center gap-0.5">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0
                                ${isComp ? 'bg-green-500 text-white' : isCurr ? 'bg-blue-600 text-white ring-1 ring-offset-1 ring-blue-300' : 'bg-gray-200 text-gray-400'}`}>
                                {isComp ? '✓' : i + 1}
                              </div>
                              <span className={`text-[8px] font-semibold ${isComp ? 'text-green-600' : isCurr ? 'text-blue-700' : 'text-gray-400'}`}>
                                {label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Cycle # */}
                    <span className="text-[11px] text-gray-400 shrink-0">Cycle {c.cycleNumber}</span>

                    {/* Status badge */}
                    <div className="shrink-0">
                      <CycleStepBadge cycleStatus={c.status} approvedBySenco={c.approvedBySenco} />
                    </div>

                    {/* Review date */}
                    <div className="ml-auto shrink-0">
                      <ReviewDueBadge reviewDate={c.reviewDate} />
                    </div>

                    {/* Do content snippet */}
                    {c.doContent && (
                      <p className="hidden lg:block text-[11px] text-gray-500 truncate max-w-[180px]">
                        {c.doContent.slice(0, 80)}
                      </p>
                    )}

                    {/* Manage indicator */}
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 group-hover:text-blue-800">
                      Manage <Icon name="chevron_right" size="sm" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl py-12 text-center mb-6">
              <Icon name="loop" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-2">No active APDR cycles yet.</p>
              <p className="text-[12px] text-gray-400 mt-1">
                Approve an ILP in{' '}
                <Link href="/senco/ilp" className="text-blue-600 hover:underline">ILP Records</Link>
                {' '}to auto-generate the first cycle.
              </p>
            </div>
          )}

          {/* Completed cycles (collapsed) */}
          {completed.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <Icon name="check_circle" size="sm" className="text-gray-400" />
                <h2 className="text-[14px] font-semibold text-gray-700">Completed cycles</h2>
                <span className="ml-auto text-[11px] text-gray-400">{completed.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {completed.map(c => (
                  <Link key={c.id} href={`/students/${c.studentId}?tab=APDR`} className="flex items-center gap-4 px-5 py-3 hover:bg-blue-50 transition-colors group">
                    <div className="w-44 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-medium text-gray-700 truncate">{c.studentName}</p>
                        {c.sendStatus !== 'NONE' && (
                          <SendBadge status={c.sendStatus as 'EHCP' | 'SEN_SUPPORT'} showTier />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">{c.yearGroup ? `Year ${c.yearGroup}` : '—'}</p>
                    </div>
                    <span className="text-[11px] text-gray-400">Cycle {c.cycleNumber}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      <Icon name="check_circle" size="sm" />All phases complete
                    </span>
                    <span className="ml-auto text-[11px] text-gray-400">
                      Completed {new Date(c.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 group-hover:text-blue-600">
                      View <Icon name="chevron_right" size="sm" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
