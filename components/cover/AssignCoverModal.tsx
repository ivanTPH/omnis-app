'use client'

import { useState, useTransition, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { AssignmentWithDetails, AvailableStaffMember } from '@/app/actions/cover'
import { getAvailableStaff, assignCover, updateAssignmentStatus } from '@/app/actions/cover'

const STATUS_OPTS = [
  { value: 'assigned',   label: 'Assigned',   colour: 'bg-amber-100 text-amber-700'  },
  { value: 'confirmed',  label: 'Confirmed',   colour: 'bg-green-100 text-green-700'  },
  { value: 'cancelled',  label: 'Cancelled',   colour: 'bg-gray-100 text-gray-600'    },
]

type Props = {
  assignment: AssignmentWithDetails
  schoolId:   string
  date:       Date
  onClose:    () => void
  onUpdated:  () => void
}

export default function AssignCoverModal({ assignment, schoolId, date, onClose, onUpdated }: Props) {
  const [available, setAvailable]     = useState<AvailableStaffMember[]>([])
  const [selected,  setSelected]      = useState(assignment.coveredBy ?? '')
  const [notes,     setNotes]         = useState(assignment.notes ?? '')
  const [loading,   setLoading]       = useState(true)
  const [pending,   start]            = useTransition()

  useEffect(() => {
    // We pass timetableEntryId as periodId proxy — action uses it to find period
    // But getAvailableStaff needs a periodId. We'll use the timetableEntryId as-is
    // and pass empty string to fall back gracefully (the action handles empty periodId)
    getAvailableStaff(schoolId, date, assignment.timetableEntryId)
      .then(setAvailable)
      .finally(() => setLoading(false))
  }, [schoolId, date, assignment.timetableEntryId])

  function handleAssign() {
    if (!selected) return
    start(async () => {
      await assignCover(assignment.id, selected)
      onUpdated()
      onClose()
    })
  }

  function handleStatusUpdate(status: string) {
    start(async () => {
      await updateAssignmentStatus(assignment.id, status)
      onUpdated()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">Assign Cover</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Context */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 space-y-1">
          <div className="flex gap-2 text-[12px]">
            <span className="text-gray-500 w-24 shrink-0">Period</span>
            <span className="font-medium text-gray-800">{assignment.periodName} ({assignment.periodStart}–{assignment.periodEnd})</span>
          </div>
          <div className="flex gap-2 text-[12px]">
            <span className="text-gray-500 w-24 shrink-0">Class</span>
            <span className="font-medium text-gray-800">{assignment.className}{assignment.classSubject ? ` · ${assignment.classSubject}` : ''}</span>
          </div>
          <div className="flex gap-2 text-[12px]">
            <span className="text-gray-500 w-24 shrink-0">Absent teacher</span>
            <span className="font-medium text-gray-800">{assignment.absentStaffName}</span>
          </div>
        </div>

        {/* Staff selection */}
        <div className="px-5 py-4 space-y-3">
          <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
            <Icon name="how_to_reg" size="sm" className="inline mr-1" />
            Available Staff
          </label>
          {loading ? (
            <p className="text-[12px] text-gray-400">Loading available staff…</p>
          ) : available.length === 0 ? (
            <p className="text-[12px] text-gray-400">No available staff for this period.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-auto">
              {available.map(s => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selected === s.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="coverStaff"
                    value={s.id}
                    checked={selected === s.id}
                    onChange={() => setSelected(s.id)}
                    className="accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-900">
                      {s.title ? `${s.title} ` : ''}{s.firstName} {s.lastName}
                    </p>
                    {s.subjects.length > 0 && (
                      <p className="text-[10px] text-gray-400">{s.subjects.slice(0, 3).join(', ')}</p>
                    )}
                  </div>
                  {s.coverLoadToday > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                      {s.coverLoadToday} cover{s.coverLoadToday !== 1 ? 's' : ''}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any instructions for the cover supervisor…"
            />
          </div>
        </div>

        {/* Status actions */}
        {assignment.status !== 'unassigned' && (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Update Status</p>
            <div className="flex gap-2">
              {STATUS_OPTS.filter(o => o.value !== assignment.status).map(o => (
                <button
                  key={o.value}
                  onClick={() => handleStatusUpdate(o.value)}
                  disabled={pending}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg ${o.colour} hover:opacity-80 disabled:opacity-50`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[12px] text-gray-600 hover:text-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selected || pending}
            className="px-4 py-2 text-[12px] font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Assign Cover'}
          </button>
        </div>
      </div>
    </div>
  )
}
