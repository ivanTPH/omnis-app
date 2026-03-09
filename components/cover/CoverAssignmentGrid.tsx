'use client'

import { useState } from 'react'
import type { AssignmentWithDetails, AbsenceWithStaff } from '@/app/actions/cover'
import AssignCoverModal from './AssignCoverModal'

const STATUS_BADGE: Record<string, string> = {
  unassigned: 'bg-red-100 text-red-700',
  assigned:   'bg-amber-100 text-amber-700',
  confirmed:  'bg-green-100 text-green-700',
  cancelled:  'bg-gray-100 text-gray-500 line-through',
}

const STATUS_LABEL: Record<string, string> = {
  unassigned: 'Unassigned',
  assigned:   'Assigned',
  confirmed:  'Confirmed',
  cancelled:  'Cancelled',
}

type Props = {
  assignments:       AssignmentWithDetails[]
  absences:          AbsenceWithStaff[]
  selectedAbsenceId: string | null
  schoolId:          string
  date:              Date
  onUpdated:         () => void
}

export default function CoverAssignmentGrid({
  assignments,
  absences,
  selectedAbsenceId,
  schoolId,
  date,
  onUpdated,
}: Props) {
  const [openAssignment, setOpenAssignment] = useState<AssignmentWithDetails | null>(null)

  const visible = selectedAbsenceId
    ? assignments.filter(a => a.absenceId === selectedAbsenceId)
    : assignments

  // Group by period for display
  const byPeriod = new Map<string, AssignmentWithDetails[]>()
  for (const a of visible) {
    const key = a.periodName || 'Unknown Period'
    if (!byPeriod.has(key)) byPeriod.set(key, [])
    byPeriod.get(key)!.push(a)
  }

  const periods = [...byPeriod.keys()].sort()

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center">
        <p className="text-[12px] text-gray-400">
          {assignments.length === 0
            ? 'No lessons need cover for this date.'
            : 'Select an absence to see its lessons, or deselect to see all.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {periods.map(period => (
          <div key={period}>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {period}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {byPeriod.get(period)!.map(a => (
                <button
                  key={a.id}
                  onClick={() => setOpenAssignment(a)}
                  className="text-left border border-gray-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-sm transition-all bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 truncate">{a.className}</p>
                      {a.classSubject && (
                        <p className="text-[11px] text-gray-400">{a.classSubject}</p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Absent: {a.absentStaffName}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${STATUS_BADGE[a.status] ?? STATUS_BADGE.unassigned}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                  {a.coverName && (
                    <p className="mt-1.5 text-[11px] text-green-700 font-medium">
                      Cover: {a.coverName}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-gray-400">
                    {a.periodStart}–{a.periodEnd}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {openAssignment && (
        <AssignCoverModal
          assignment={openAssignment}
          schoolId={schoolId}
          date={date}
          onClose={() => setOpenAssignment(null)}
          onUpdated={() => { onUpdated(); setOpenAssignment(null) }}
        />
      )}
    </>
  )
}
