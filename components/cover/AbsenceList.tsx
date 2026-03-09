'use client'

import { useState, useTransition } from 'react'
import { Trash2, AlertCircle } from 'lucide-react'
import type { AbsenceWithStaff } from '@/app/actions/cover'
import { deleteAbsence } from '@/app/actions/cover'

const REASON_COLOURS: Record<string, string> = {
  illness:  'bg-red-100 text-red-700',
  training: 'bg-blue-100 text-blue-700',
  personal: 'bg-amber-100 text-amber-700',
  other:    'bg-gray-100 text-gray-600',
}

const REASON_LABELS: Record<string, string> = {
  illness:  'Illness',
  training: 'Training',
  personal: 'Personal',
  other:    'Other',
}

type Props = {
  absences:         AbsenceWithStaff[]
  selectedAbsenceId: string | null
  onSelect:         (id: string | null) => void
  onDeleted:        (id: string) => void
}

export default function AbsenceList({ absences, selectedAbsenceId, onSelect, onDeleted }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pending, start]          = useTransition()

  function handleDelete(id: string) {
    start(async () => {
      await deleteAbsence(id)
      onDeleted(id)
      setConfirmId(null)
      if (selectedAbsenceId === id) onSelect(null)
    })
  }

  if (absences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <AlertCircle size={20} className="text-gray-300 mb-2" />
        <p className="text-[12px] text-gray-400">No absences logged for this date.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {absences.map(a => {
        const selected = selectedAbsenceId === a.id
        return (
          <div
            key={a.id}
            onClick={() => onSelect(selected ? null : a.id)}
            className={`border rounded-xl p-3 cursor-pointer transition-colors ${
              selected
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{a.staffName}</p>
                <p className="text-[11px] text-gray-400">{a.staffRole}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${REASON_COLOURS[a.reason] ?? REASON_COLOURS.other}`}>
                  {REASON_LABELS[a.reason] ?? a.reason}
                </span>
                {confirmId === a.id ? (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(a.id) }}
                      disabled={pending}
                      className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmId(null) }}
                      className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmId(a.id) }}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete absence"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
              <span>{a.assignmentCount} lesson{a.assignmentCount !== 1 ? 's' : ''} affected</span>
              {a.unassignedCount > 0 && (
                <span className="text-red-600 font-medium">{a.unassignedCount} unassigned</span>
              )}
              {a.unassignedCount === 0 && a.assignmentCount > 0 && (
                <span className="text-green-600 font-medium">All covered</span>
              )}
            </div>
            {a.notes && (
              <p className="mt-1.5 text-[11px] text-gray-500 italic truncate">{a.notes}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
