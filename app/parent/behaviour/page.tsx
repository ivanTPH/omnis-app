import { requireAuth }                from '@/lib/session'
import { redirect }                  from 'next/navigation'
import Link                          from 'next/link'
import AppShell                      from '@/components/AppShell'
import Icon                          from '@/components/ui/Icon'
import { getChildBehaviourSummary }  from '@/app/actions/behaviour'

export const dynamic = 'force-dynamic'

const TYPE_STYLES: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-rose-100 text-rose-700',
  neutral:  'bg-gray-100 text-gray-600',
}

const TYPE_ICONS: Record<string, string> = {
  positive: 'thumb_up',
  negative: 'thumb_down',
  neutral:  'remove',
}

export default async function ParentBehaviourPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'PARENT') redirect('/dashboard')

  const children = await getChildBehaviourSummary()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/parent/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Dashboard
            </Link>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-1">Behaviour Records</h1>
          <p className="text-[13px] text-gray-400 mb-6">
            Behaviour data synced from school MIS (Wonde) and records logged by staff
          </p>

          {children.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
              <Icon name="people" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No linked children found.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {children.map(child => {
                const totalPos = (child.wondePositive ?? 0) + child.records.filter(r => r.type === 'positive').length
                const totalNeg = (child.wondeNegative ?? 0) + child.records.filter(r => r.type === 'negative').length

                return (
                  <div key={child.studentId}>
                    {/* Child name header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {child.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <h2 className="text-[15px] font-semibold text-gray-900">{child.studentName}</h2>
                      {child.yearGroup && (
                        <span className="text-[11px] text-gray-400">Year {child.yearGroup}</span>
                      )}
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Positive</p>
                        <p className="text-2xl font-bold text-emerald-600">{totalPos > 0 ? `+${totalPos}` : '—'}</p>
                        {child.wondePositive != null && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{child.wondePositive} from school MIS</p>
                        )}
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Negative</p>
                        <p className="text-2xl font-bold text-rose-600">{totalNeg > 0 ? `-${totalNeg}` : '—'}</p>
                        {child.wondeNegative != null && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{child.wondeNegative} from school MIS</p>
                        )}
                      </div>
                      <div className={`border rounded-xl px-4 py-3 ${child.hasExclusion ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-200'}`}>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Exclusion</p>
                        {child.hasExclusion === true ? (
                          <p className="text-[14px] font-semibold text-rose-700 flex items-center gap-1">
                            <Icon name="block" size="sm" /> On record
                          </p>
                        ) : child.hasExclusion === false ? (
                          <p className="text-[14px] font-semibold text-emerald-600">None</p>
                        ) : (
                          <p className="text-[14px] text-gray-400">—</p>
                        )}
                      </div>
                    </div>

                    {/* Staff-logged records */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                        <Icon name="assignment" size="sm" className="text-gray-400" />
                        <h3 className="text-[13px] font-semibold text-gray-900">Staff-logged records</h3>
                        <span className="ml-auto text-[11px] text-gray-400">{child.records.length} record{child.records.length !== 1 ? 's' : ''}</span>
                      </div>

                      {child.records.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                          <Icon name="check_circle" size="md" className="text-gray-300 mx-auto mb-2" />
                          <p className="text-[12px] text-gray-400">No staff-logged behaviour records.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {child.records.map(r => (
                            <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${TYPE_STYLES[r.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                <Icon name={TYPE_ICONS[r.type] ?? 'circle'} size="sm" />
                                {r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-gray-700">{r.description}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {r.category.charAt(0).toUpperCase() + r.category.slice(1)} · {r.authorName} ·{' '}
                                  {new Date(r.recordDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              {r.points !== 0 && (
                                <span className={`text-[12px] font-semibold shrink-0 ${r.points > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {r.points > 0 ? `+${r.points}` : r.points}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-6 text-[11px] text-gray-400">
            MIS data is synced by your school. Contact the school directly if you have questions about any record.
          </p>

        </div>
      </main>
    </AppShell>
  )
}
