'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import ExportPdfButton from '@/components/ExportPdfButton'
import { gradeLabel } from '@/lib/grading'
import { getInclusionEvidenceReport } from '@/app/actions/analytics'
import type { InclusionReportData, InclusionReportFilters } from '@/app/actions/analytics'

const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13]

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function pct(n: number | null): string {
  return n == null ? '—' : `${n}%`
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' | 'red' | 'blue' }) {
  const toneClasses: Record<string, string> = {
    default: 'bg-white border-gray-200',
    green:   'bg-green-50 border-green-200',
    amber:   'bg-amber-50 border-amber-200',
    red:     'bg-red-50 border-red-200',
    blue:    'bg-blue-50 border-blue-200',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  )
}

export default function InclusionReportView() {
  const [yearGroups, setYearGroups]   = useState<number[]>([])
  const [sendStatus, setSendStatus]   = useState<NonNullable<InclusionReportFilters['sendStatus']>>('ALL')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [studentId, setStudentId]     = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)

  const [data, setData]       = useState<InclusionReportData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleYearGroup(yg: number) {
    setYearGroups(prev => prev.includes(yg) ? prev.filter(y => y !== yg) : [...prev, yg].sort((a, b) => a - b))
  }

  function generate() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await getInclusionEvidenceReport({
          yearGroups: yearGroups.length ? yearGroups : undefined,
          sendStatus,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          studentId: studentId ?? undefined,
        })
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate report')
        setData(null)
      }
    })
  }

  function viewCaseStudy(id: string, name: string) {
    setStudentId(id)
    setStudentName(name)
    setError(null)
    startTransition(async () => {
      try {
        const result = await getInclusionEvidenceReport({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          studentId: id,
        })
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate case study')
      }
    })
  }

  function clearCaseStudy() {
    setStudentId(null)
    setStudentName(null)
    setData(null)
  }

  const queryString = (() => {
    const params = new URLSearchParams()
    if (yearGroups.length && !studentId) params.set('yearGroups', yearGroups.join(','))
    if (!studentId) params.set('sendStatus', sendStatus)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (studentId) params.set('studentId', studentId)
    return params.toString()
  })()

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        {studentId ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] text-gray-700">
              <Icon name="person" size="sm" className="text-blue-600" />
              Case-study mode — <strong>{studentName}</strong>
            </div>
            <button onClick={clearCaseStudy} className="text-[12px] text-blue-600 hover:underline flex items-center gap-1">
              <Icon name="close" size="sm" /> Back to cohort filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Year group</label>
                <div className="flex flex-wrap gap-1.5">
                  {YEAR_GROUPS.map(yg => (
                    <button
                      key={yg}
                      onClick={() => toggleYearGroup(yg)}
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition ${
                        yearGroups.includes(yg)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Y{yg}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{yearGroups.length ? `${yearGroups.length} selected` : 'All year groups'}</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SEND status</label>
                <select
                  value={sendStatus}
                  onChange={e => setSendStatus(e.target.value as 'NONE' | 'SEN_SUPPORT' | 'EHCP' | 'ALL')}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-[13px]"
                >
                  <option value="ALL">SEN Support + EHCP (register)</option>
                  <option value="SEN_SUPPORT">SEN Support only</option>
                  <option value="EHCP">EHCP only</option>
                  <option value="NONE">No identified SEND</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date range</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[13px]" />
                  <span className="text-gray-300">–</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[13px]" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Defaults to the current term if left blank</p>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={generate}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {pending ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="analytics" size="sm" />}
            {pending ? 'Generating…' : 'Generate report'}
          </button>
          {data && (
            <>
              <ExportPdfButton
                href={`/api/export/inclusion-evidence-report?${queryString}`}
                filename={`inclusion-evidence-report-${isoDate(new Date())}.pdf`}
                label="Export PDF"
              />
              {!studentId && (
                <ExportPdfButton
                  href={`/api/export/inclusion-evidence-report/csv?${queryString}`}
                  filename={`inclusion-evidence-report-${isoDate(new Date())}.csv`}
                  label="Export CSV"
                />
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl px-4 py-3">{error}</div>
      )}

      {!data && !pending && !error && (
        <div className="text-center py-16 text-gray-400">
          <Icon name="fact_check" size="lg" className="mx-auto mb-2 opacity-40" />
          <p className="text-[13px]">Set your filters and click Generate report to see the inclusion evidence summary.</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <p className="text-[12px] text-gray-400">
            {data.filters.yearGroupsLabel} &middot; {data.filters.sendStatusLabel} &middot; {data.filters.periodLabel}
            {data.filters.studentName ? ` · ${data.filters.studentName}` : ''}
            {' · Generated ' + new Date(data.generatedAt).toLocaleString('en-GB')}
          </p>

          {!data.section7CaseStudy && (
            <>
              {/* Section 1 */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">1. SEND register summary</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="On SEND register" value={String(data.section1Register.total)} tone="blue" />
                  <StatCard label="% of roll" value={pct(data.section1Register.pctOfRoll)} />
                  <StatCard label="SEN Support" value={String(data.section1Register.senSupport)} />
                  <StatCard label="EHCP" value={String(data.section1Register.ehcp)} />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  New identifications this period: <strong>{data.section1Register.newIdentificationsThisPeriod}</strong> (prior period: {data.section1Register.newIdentificationsPriorPeriod})
                </p>
              </section>

              {/* Section 2 */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">2. Identification &amp; responsiveness</h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Avg. days: concern → approved ILP"
                    value={data.section2Responsiveness.avgDaysToApprovedIlp != null ? String(data.section2Responsiveness.avgDaysToApprovedIlp) : 'No matched cases'}
                    tone={data.section2Responsiveness.avgDaysToApprovedIlp == null ? 'default' : data.section2Responsiveness.avgDaysToApprovedIlp <= 20 ? 'green' : data.section2Responsiveness.avgDaysToApprovedIlp <= 40 ? 'amber' : 'red'}
                  />
                  <StatCard label="Matched cases" value={String(data.section2Responsiveness.matchedCaseCount)} />
                </div>
              </section>

              {/* Section 3 */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">3. ILP coverage &amp; currency</h2>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Approved ILP coverage" value={pct(data.section3IlpCoverage.coveragePct)} tone={(data.section3IlpCoverage.coveragePct ?? 0) >= 90 ? 'green' : 'amber'} />
                  <StatCard label="Overdue for review" value={String(data.section3IlpCoverage.overdueCount)} tone={data.section3IlpCoverage.overdueCount > 0 ? 'red' : 'green'} />
                  <StatCard label="Cohort size" value={String(data.section3IlpCoverage.cohortSize)} />
                </div>
                {data.section3IlpCoverage.oldestOverdue && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700">
                    Oldest overdue: <strong>{data.section3IlpCoverage.oldestOverdue.studentName}</strong> — {data.section3IlpCoverage.oldestOverdue.daysOverdue} days overdue
                  </div>
                )}
              </section>

              {/* Section 4 */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">4. EHCP compliance</h2>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Total EHCPs" value={String(data.section4EhcpCompliance.total)} />
                  <StatCard label="Within 12-month window" value={pct(data.section4EhcpCompliance.withinWindowPct)} tone={(data.section4EhcpCompliance.withinWindowPct ?? 0) >= 100 ? 'green' : (data.section4EhcpCompliance.withinWindowPct ?? 0) >= 80 ? 'amber' : 'red'} />
                  <StatCard label="Overdue reviews" value={String(data.section4EhcpCompliance.overdueCount)} tone={data.section4EhcpCompliance.overdueCount > 0 ? 'red' : 'green'} />
                </div>
                {data.section4EhcpCompliance.overdueList.length > 0 && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700 space-y-1">
                    <p className="font-semibold">Compliance risk — overdue EHCP reviews:</p>
                    {data.section4EhcpCompliance.overdueList.map(o => (
                      <p key={o.studentId}>{o.studentName} — {o.daysOverdue} days overdue</p>
                    ))}
                  </div>
                )}
              </section>

              {/* Section 5 */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">5. Evidence-backed progress</h2>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {data.section5Evidence.attainmentByStatus.map(a => (
                    <StatCard key={a.status} label={a.label} value={`${gradeLabel(a.avgScore != null ? Math.round(a.avgScore) : null)} (n=${a.count})`} />
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <StatCard label="Progress evidence" value={String(data.section5Evidence.evidenceCounts.progress)} tone="green" />
                  <StatCard label="Concern evidence" value={String(data.section5Evidence.evidenceCounts.concern)} tone="red" />
                  <StatCard label="Neutral evidence" value={String(data.section5Evidence.evidenceCounts.neutral)} />
                  <StatCard label="Total entries" value={String(data.section5Evidence.evidenceCounts.total)} tone="blue" />
                </div>
              </section>

              {/* Section 6 */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">6. Parent &amp; pupil voice</h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Parent ILP responses" value={String(data.section6Voice.parentResponseCount)} tone="blue" />
                  <StatCard label="Meetings requested" value={String(data.section6Voice.meetingRequestedCount)} />
                </div>
              </section>

              {/* Register table */}
              <section>
                <h2 className="text-[15px] font-bold text-gray-900 mb-3">Register — click a student for a case-study report</h2>
                {data.registerRows.length === 0 ? (
                  <p className="text-[13px] text-gray-400">No students match these filters.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-[12px]">
                      <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-3 py-2">Student</th>
                          <th className="text-left px-3 py-2">Year</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Need area</th>
                          <th className="text-left px-3 py-2">ILP</th>
                          <th className="text-left px-3 py-2">Concerns</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.registerRows.map(r => (
                          <tr key={r.studentId} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{r.studentName}</td>
                            <td className="px-3 py-2 text-gray-500">{r.yearGroup ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.sendStatus.replace('_', ' ')}</td>
                            <td className="px-3 py-2 text-gray-500">{r.needArea ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.ilpApproved ? 'Approved' : (r.ilpStatus ?? 'None')}</td>
                            <td className="px-3 py-2 text-gray-500">{r.openConcernCount}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => viewCaseStudy(r.studentId, r.studentName)} className="text-blue-600 hover:underline text-[11px] font-medium">
                                Case study →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {data.section7CaseStudy && (
            <section className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="text-[16px] font-bold text-gray-900">{data.section7CaseStudy.studentName}</h2>
                <p className="text-[12px] text-gray-500 mb-3">
                  Year {data.section7CaseStudy.yearGroup ?? '—'} · {data.section7CaseStudy.sendStatus.replace('_', ' ')} · {data.section7CaseStudy.needArea ?? 'Need area not specified'}
                </p>

                <h3 className="text-[12px] font-semibold text-gray-700 mt-4 mb-1">Need identified</h3>
                <p className="text-[13px] text-gray-600">{data.section7CaseStudy.areasOfNeed || 'Not recorded'}</p>

                <h3 className="text-[12px] font-semibold text-gray-700 mt-4 mb-1">Strengths</h3>
                <p className="text-[13px] text-gray-600">{data.section7CaseStudy.currentStrengths || 'Not recorded'}</p>

                <h3 className="text-[12px] font-semibold text-gray-700 mt-4 mb-1">Plan — targets ({data.section7CaseStudy.targets.length})</h3>
                {data.section7CaseStudy.targets.map((t, i) => (
                  <div key={i} className="text-[13px] text-gray-600 border-l-2 border-blue-200 pl-2 mb-1.5">
                    {t.target} — <span className="text-gray-400">{t.status.replace('_', ' ')}</span>
                  </div>
                ))}

                <h3 className="text-[12px] font-semibold text-gray-700 mt-4 mb-1">Evidence timeline ({data.section7CaseStudy.evidenceTimeline.length})</h3>
                {data.section7CaseStudy.evidenceTimeline.slice(0, 5).map((e, i) => (
                  <div key={i} className="text-[13px] text-gray-600 border-l-2 border-gray-200 pl-2 mb-1.5">
                    {new Date(e.date).toLocaleDateString('en-GB')} — {e.type} — {e.homeworkTitle}
                  </div>
                ))}

                <h3 className="text-[12px] font-semibold text-gray-700 mt-4 mb-1">Parent &amp; pupil voice ({data.section7CaseStudy.parentVoice.length})</h3>
                {data.section7CaseStudy.parentVoice.length === 0
                  ? <p className="text-[13px] text-gray-400">No parent responses recorded yet.</p>
                  : data.section7CaseStudy.parentVoice.map((p, i) => (
                    <div key={i} className="text-[13px] text-gray-600 border-l-2 border-purple-200 pl-2 mb-1.5">
                      {new Date(p.reviewedAt).toLocaleDateString('en-GB')} — {p.homeProgress ?? 'No note'} {p.meetingRequested ? '(meeting requested)' : ''}
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
