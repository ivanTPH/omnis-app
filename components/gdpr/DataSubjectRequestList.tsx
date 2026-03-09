'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import type { DsrRow } from '@/app/actions/gdpr'
import { updateDsrStatus } from '@/app/actions/gdpr'

const STATUS_COLOURS: Record<string, string> = {
  pending:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
  rejected:    'Rejected',
}

const TYPE_LABELS: Record<string, string> = {
  access:          'Subject Access',
  erasure:         'Right to Erasure',
  rectification:   'Rectification',
  portability:     'Data Portability',
}

type Props = {
  dsrs: DsrRow[]
}

export default function DataSubjectRequestList({ dsrs }: Props) {
  const [updating, startUpdate]   = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  function handleStatusChange(id: string, status: string) {
    setUpdatingId(id)
    startUpdate(async () => {
      await updateDsrStatus(id, status)
      setUpdatingId(null)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{dsrs.length} request{dsrs.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-400 border border-dashed border-gray-200 rounded-lg cursor-not-allowed select-none">
          <Plus size={13} /> New Request <span className="text-[10px] text-gray-300">(coming soon)</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Submitted</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Notes</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Resolved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dsrs.map(d => (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                  {TYPE_LABELS[d.requestType] ?? d.requestType}
                </td>
                <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(d.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-3 py-3 text-gray-500 max-w-[200px] truncate">
                  {d.notes ?? '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOURS[d.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                    <select
                      defaultValue={d.status}
                      disabled={updating && updatingId === d.id}
                      onChange={e => handleStatusChange(d.id, e.target.value)}
                      className="text-[11px] border border-gray-200 rounded-md px-1.5 py-0.5 bg-white focus:outline-none disabled:opacity-50"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                  {d.resolvedAt ? new Date(d.resolvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dsrs.length === 0 && (
          <p className="text-center py-8 text-[13px] text-gray-400">No data subject requests recorded.</p>
        )}
      </div>
    </div>
  )
}
