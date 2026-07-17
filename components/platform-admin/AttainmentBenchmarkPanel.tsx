'use client'

/**
 * INTERNAL USE ONLY — not for external display or sharing.
 * Outcome benchmarking data is consent-gated and suppressed for small cohorts.
 * See evidence/phase-outcome-benchmarking/README.md for the DPIA addendum.
 */

import type { AttainmentBenchmarkRow } from '@/lib/attainment-benchmark'

type Props = {
  bySchool: Record<string, AttainmentBenchmarkRow[]>
  network:  {
    schoolCount:     number
    studentCount:    number
    consentedCount:  number
    avgUplift:       number
    upliftAvailable: boolean
  } | null
}

function UpliftChip({ value }: { value: number }) {
  if (value > 0) return <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">+{value}%</span>
  if (value < 0) return <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{value}%</span>
  return <span className="text-xs text-gray-400">—</span>
}

export default function AttainmentBenchmarkPanel({ bySchool, network }: Props) {
  const schoolCount = Object.keys(bySchool).length
  const hasData     = schoolCount > 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900">Outcome Benchmarking</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Internal — do not share externally
            </span>
          </div>
          <p className="text-[13px] text-gray-500">
            Consent-gated · suppressed below {10} consented students ·{' '}
            <span className="text-gray-400 italic">uplift model is a placeholder — requires academic review</span>
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="py-8 text-center">
          <span className="material-icons text-3xl text-gray-300 mb-2 block">bar_chart</span>
          <p className="text-sm text-gray-500">No benchmark data yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Data populates once parents opt in to outcome benchmarking and the
            aggregation job runs (triggered manually or via cron).
          </p>
        </div>
      ) : (
        <>
          {/* Network aggregate */}
          {network && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Schools with data', value: network.schoolCount.toString() },
                { label: 'Total students', value: network.studentCount.toLocaleString() },
                { label: 'Consented students', value: network.consentedCount.toLocaleString() },
                {
                  label: 'Network avg uplift',
                  value: network.upliftAvailable
                    ? `${network.avgUplift > 0 ? '+' : ''}${network.avgUplift}%`
                    : 'Suppressed',
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-school breakdown */}
          <div className="space-y-4">
            {Object.entries(bySchool).map(([schoolId, rows]) => (
              <div key={schoolId} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                  <span className="material-icons text-gray-400 text-base">school</span>
                  <span className="text-xs font-mono text-gray-500">{schoolId}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2 text-left">Year</th>
                      <th className="px-4 py-2 text-right">Period</th>
                      <th className="px-4 py-2 text-right">Consented</th>
                      <th className="px-4 py-2 text-right">Prior</th>
                      <th className="px-4 py-2 text-right">Predicted</th>
                      <th className="px-4 py-2 text-right">Actual</th>
                      <th className="px-4 py-2 text-right">Uplift</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 font-medium">Y{row.yearGroup}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{row.periodLabel}</td>
                        <td className="px-4 py-2 text-right">{row.consentedCohortSize}/{row.cohortSize}</td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {row.suppressed ? '—' : row.avgPriorAttainment}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {row.suppressed ? '—' : `Gr ${row.avgPredictedOutcome}`}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {row.suppressed ? '—' : `Gr ${row.avgActualOutcome}`}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {row.suppressed ? <span className="text-xs text-gray-400">—</span> : <UpliftChip value={row.upliftPercent} />}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {row.suppressed
                            ? <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Suppressed</span>
                            : <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
