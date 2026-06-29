import { requireAuth }              from '@/lib/session'
import { redirect }                from 'next/navigation'
import Link                        from 'next/link'
import AppShell                    from '@/components/AppShell'
import Icon                        from '@/components/ui/Icon'
import { getStudentSupportProfile } from '@/app/actions/student'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  active:             'bg-blue-100 text-blue-700',
  deferred:           'bg-amber-100 text-amber-700',
  achieved:           'bg-emerald-100 text-emerald-700',
  not_achieved:       'bg-rose-100 text-rose-700',
  partially_achieved: 'bg-amber-100 text-amber-700',
}

const STATUS_LABEL: Record<string, string> = {
  active:             'Active',
  deferred:           'Deferred',
  achieved:           'Achieved',
  not_achieved:       'Not achieved',
  partially_achieved: 'Partly achieved',
}

export default async function StudentSupportPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'STUDENT') redirect('/dashboard')

  const profile = await getStudentSupportProfile()

  const hasSend = profile.sendStatus !== 'NONE'

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/student/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Dashboard
            </Link>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-1">My Support Plan</h1>
          <p className="text-[13px] text-gray-400 mb-6">
            Your SEND support information and learning targets set by your school
          </p>

          {!hasSend ? (
            <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
              <Icon name="check_circle" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No active support plan on record.</p>
              <p className="text-[12px] text-gray-400 mt-1">
                Speak to your SENCO{profile.sencoName ? ` (${profile.sencoName})` : ''} if you think this is incorrect.
              </p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* SEND status card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Icon name="accessibility_new" size="sm" className="text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-gray-900">
                        {profile.sendStatus === 'EHCP' ? 'EHCP (Education, Health & Care Plan)' : 'SEN Support'}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${profile.sendStatus === 'EHCP' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                        {profile.sendStatus === 'EHCP' ? 'Specialist' : 'Targeted'}
                      </span>
                    </div>
                    {profile.needArea && (
                      <p className="text-[12px] text-gray-500">{profile.needArea}</p>
                    )}
                  </div>
                </div>
                {profile.supportSnapshot && (
                  <p className="text-[13px] text-gray-700 bg-amber-50 rounded-lg px-4 py-3 border border-amber-100">
                    {profile.supportSnapshot}
                  </p>
                )}
                {profile.sencoName && (
                  <p className="text-[12px] text-gray-400 mt-3 flex items-center gap-1">
                    <Icon name="person" size="sm" />
                    Your SENCO: <span className="font-medium text-gray-600 ml-1">{profile.sencoName}</span>
                  </p>
                )}
              </div>

              {/* ILP targets */}
              {profile.ilp && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Icon name="flag" size="sm" className="text-blue-600" />
                    <h2 className="text-[14px] font-semibold text-gray-900">My Learning Targets</h2>
                    <span className="ml-auto text-[11px] text-gray-400">{profile.ilp.targets.length} target{profile.ilp.targets.length !== 1 ? 's' : ''}</span>
                  </div>

                  {profile.ilp.areasOfNeed && (
                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                      <p className="text-[12px] text-blue-800">{profile.ilp.areasOfNeed}</p>
                    </div>
                  )}

                  {profile.ilp.targets.length === 0 ? (
                    <p className="px-5 py-4 text-[13px] text-gray-400">No active targets set yet.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {profile.ilp.targets.map((t, i) => (
                        <div key={t.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-gray-900">{t.target}</p>
                              {t.strategy && (
                                <p className="text-[12px] text-gray-500 mt-1">{t.strategy}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {STATUS_LABEL[t.status] ?? t.status}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  Target: {new Date(t.targetDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EHCP outcomes */}
              {profile.ehcp && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Icon name="fact_check" size="sm" className="text-purple-600" />
                    <h2 className="text-[14px] font-semibold text-gray-900">EHCP Outcomes</h2>
                    <span className="ml-auto text-[11px] text-gray-400">
                      Review: {new Date(profile.ehcp.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  {profile.ehcp.outcomes.length === 0 ? (
                    <p className="px-5 py-4 text-[13px] text-gray-400">No active EHCP outcomes on record.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {profile.ehcp.outcomes.map(o => (
                        <div key={o.id} className="px-5 py-3 flex items-start gap-3">
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            {o.section}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-gray-700">{o.outcomeText}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-gray-400 mt-2">
                This information is set by your school. Talk to your SENCO{profile.sencoName ? ` (${profile.sencoName})` : ''} if you have any questions.
              </p>

            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
