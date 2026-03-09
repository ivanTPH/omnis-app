'use client'

import { useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import type { ConsentMatrixStudent, ConsentPurposeData } from '@/app/actions/gdpr'
import { exportConsentCsv } from '@/app/actions/gdpr'

type Props = {
  purposes: ConsentPurposeData[]
  students: ConsentMatrixStudent[]
  schoolId: string
}

type DecisionFilter = 'all' | 'granted' | 'withdrawn' | 'unknown'

function DecisionCell({ decision }: { decision: { decision: string; recordedAt: Date } | null }) {
  if (!decision) return <span className="text-gray-300 text-[16px]">—</span>
  if (decision.decision === 'granted')
    return <span className="text-green-600 font-bold text-[14px]">✓</span>
  return <span className="text-red-500 font-bold text-[14px]">✗</span>
}

export default function ConsentMatrix({ purposes, students, schoolId }: Props) {
  const [yearFilter,     setYearFilter]     = useState<string>('all')
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all')
  const [purposeFilter,  setPurposeFilter]  = useState<string>('all')
  const [exporting,      startExport]       = useTransition()

  const yearGroups = [...new Set(students.map(s => s.yearGroup).filter(Boolean))].sort() as number[]

  const filtered = students.filter(s => {
    if (yearFilter !== 'all' && String(s.yearGroup) !== yearFilter) return false
    if (decisionFilter !== 'all' || purposeFilter !== 'all') {
      const relevantPurposes = purposeFilter === 'all' ? purposes : purposes.filter(p => p.id === purposeFilter)
      const matches = relevantPurposes.some(p => {
        const d = s.decisions[p.id]
        if (decisionFilter === 'unknown') return !d
        if (decisionFilter === 'granted')   return d?.decision === 'granted'
        if (decisionFilter === 'withdrawn') return d?.decision === 'withdrawn'
        return true
      })
      if (!matches) return false
    }
    return true
  })

  function handleExport() {
    startExport(async () => {
      const csv = await exportConsentCsv(schoolId)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `consent-matrix-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="all">All year groups</option>
          {yearGroups.map(y => <option key={y} value={String(y)}>Year {y}</option>)}
        </select>

        <select
          value={purposeFilter}
          onChange={e => setPurposeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="all">All purposes</option>
          {purposes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>

        <select
          value={decisionFilter}
          onChange={e => setDecisionFilter(e.target.value as DecisionFilter)}
          className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="all">All decisions</option>
          <option value="granted">Granted</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="unknown">Unknown</option>
        </select>

        <div className="ml-auto">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={13} />{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <p className="text-[12px] text-gray-400">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Student</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 w-12">Year</th>
              {purposes.map(p => (
                <th key={p.id} className="px-3 py-3 text-center font-semibold text-gray-600 max-w-[90px]">
                  <span className="block truncate" title={p.title}>{p.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                  {s.lastName}, {s.firstName}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-center">{s.yearGroup ?? '—'}</td>
                {purposes.map(p => (
                  <td key={p.id} className="px-3 py-2.5 text-center">
                    <DecisionCell decision={s.decisions[p.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-[13px] text-gray-400">No students match the current filters.</p>
        )}
      </div>
    </div>
  )
}
