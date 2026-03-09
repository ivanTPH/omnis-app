'use client'

import type { CoverHistoryEntry } from '@/app/actions/cover'

const REASON_LABELS: Record<string, string> = {
  illness:  'Illness',
  training: 'Training',
  personal: 'Personal',
  other:    'Other',
}

const REASON_COLOURS: Record<string, string> = {
  illness:  'bg-red-100 text-red-700',
  training: 'bg-blue-100 text-blue-700',
  personal: 'bg-amber-100 text-amber-700',
  other:    'bg-gray-100 text-gray-600',
}

type Props = { history: CoverHistoryEntry[] }

export default function CoverHistoryTable({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[12px] text-gray-400">No absences in the last 30 days.</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Staff Member</th>
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
            <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Lessons</th>
            <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Coverage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {history.map(h => (
            <tr key={h.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                {h.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-2.5 px-3 font-medium text-gray-900">{h.staffName}</td>
              <td className="py-2.5 px-3">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${REASON_COLOURS[h.reason] ?? REASON_COLOURS.other}`}>
                  {REASON_LABELS[h.reason] ?? h.reason}
                </span>
              </td>
              <td className="py-2.5 px-3 text-center text-gray-700">{h.lessonsAffected}</td>
              <td className="py-2.5 px-3 text-center">
                <span className={`font-semibold ${
                  h.coverageRate === 100 ? 'text-green-600' :
                  h.coverageRate >= 50  ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {h.lessonsAffected === 0 ? '—' : `${h.coverageRate}%`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
