/**
 * /ta/send-students — Teaching Assistant SEND overview page
 *
 * Read-only view of all SEND students in the school, showing:
 * - SEND category and tier
 * - Active ILP targets (up to 4)
 * - Classroom adjustment strategies
 * - Current APDR phase
 * - Enrolled classes
 *
 * Auth: TEACHING_ASSISTANT (and other allowed staff roles)
 */

import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import { getTaSendStudents } from '@/app/actions/ta-notes'

export const dynamic = 'force-dynamic'

const SEND_TIER: Record<string, { label: string; colour: string }> = {
  EHCP:        { label: 'Specialist (EHCP)',    colour: 'bg-purple-100 text-purple-800' },
  SEN_SUPPORT: { label: 'Targeted (SEN Support)', colour: 'bg-blue-100 text-blue-700' },
  NONE:        { label: 'Universal',            colour: 'bg-gray-100 text-gray-600' },
}

export default async function TaSendStudentsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const ALLOWED = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT']
  if (!ALLOWED.includes(role)) redirect('/ta/notes')

  const students = await getTaSendStudents()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto px-6 py-6 max-w-5xl mx-auto">
        <PageHeader
          title="SEND Students"
          subtitle={`${students.length} student${students.length !== 1 ? 's' : ''} on the SEND register`}
          backHref="/ta/notes"
          backLabel="Student Notes"
        />

        {students.length === 0 ? (
          <EmptyState
            icon="support"
            title="No SEND students found"
            description="Students on the SEND register will appear here once their profile is set up by the SENCo."
            size="md"
          />
        ) : (
          <div className="space-y-4 mt-6">
            {students.map(s => {
              const tier = SEND_TIER[s.sendStatus] ?? SEND_TIER.NONE
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="w-9 h-9 rounded-full bg-purple-200 flex items-center justify-center text-[13px] font-bold text-purple-800 shrink-0">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-gray-900">
                          {s.firstName} {s.lastName}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tier.colour}`}>
                          {tier.label}
                        </span>
                        {s.apdrPhase && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            APDR: {s.apdrPhase} phase
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {s.yearGroup && (
                          <span className="text-[11px] text-gray-400">Year {s.yearGroup}</span>
                        )}
                        {s.needArea && (
                          <span className="text-[11px] text-purple-600">{s.needArea}</span>
                        )}
                        {s.classes.length > 0 && (
                          <span className="text-[11px] text-gray-400">
                            {s.classes.slice(0, 3).map(c => c.name).join(', ')}
                            {s.classes.length > 3 && ` +${s.classes.length - 3} more`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                    {/* ILP Targets */}
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Icon name="flag" size="sm" /> Active ILP Targets
                      </p>
                      {s.ilpTargets.length === 0 ? (
                        <p className="text-[12px] text-gray-400 italic">No active ILP targets</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {s.ilpTargets.map(t => (
                            <li key={t.id} className="flex items-start gap-2">
                              <Icon
                                name={t.status === 'achieved' ? 'check_circle' : 'radio_button_unchecked'}
                                size="sm"
                                className={t.status === 'achieved' ? 'text-green-500 shrink-0 mt-0.5' : 'text-gray-300 shrink-0 mt-0.5'}
                              />
                              <span className="text-[12px] text-gray-700 leading-snug">{t.target}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Classroom Strategies */}
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Icon name="psychology" size="sm" /> Classroom Strategies
                      </p>
                      {s.supportSnapshot && (
                        <p className="text-[12px] text-gray-600 leading-relaxed mb-2 italic">{s.supportSnapshot}</p>
                      )}
                      {s.classroomStrategies.length === 0 && !s.supportSnapshot ? (
                        <p className="text-[12px] text-gray-400 italic">No strategies recorded yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {s.classroomStrategies.slice(0, 5).map((strat, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                              <Icon name="check" size="sm" className="text-blue-400 shrink-0 mt-0.5" />
                              {strat}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </AppShell>
  )
}
