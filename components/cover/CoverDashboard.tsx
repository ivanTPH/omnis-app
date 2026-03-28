'use client'

import { useState, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import type { CoverSummary, AbsenceWithStaff, AssignmentWithDetails } from '@/app/actions/cover'
import { getTodaysCoverSummary } from '@/app/actions/cover'
import AbsenceList from './AbsenceList'
import CoverAssignmentGrid from './CoverAssignmentGrid'
import LogAbsenceModal from './LogAbsenceModal'

type StaffMember = { id: string; firstName: string; lastName: string; title: string | null }

type Props = {
  schoolId:   string
  initial:    CoverSummary
  staffList:  StaffMember[]
  date:       Date
}

export default function CoverDashboard({ schoolId, initial, staffList, date }: Props) {
  const [summary,           setSummary]           = useState<CoverSummary>(initial)
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null)
  const [showLogModal,      setShowLogModal]       = useState(false)

  const refresh = useCallback(async () => {
    const fresh = await getTodaysCoverSummary(schoolId, date)
    setSummary(fresh)
  }, [schoolId, date])

  function handleAbsenceDeleted(id: string) {
    setSummary(prev => ({
      ...prev,
      absences:    prev.absences.filter(a => a.id !== id),
      assignments: prev.assignments.filter(a => a.absenceId !== id),
      unassignedCount: prev.assignments.filter(a => a.absenceId !== id && a.status === 'unassigned').length,
      totalLessons: prev.assignments.filter(a => a.absenceId !== id).length,
    }))
  }

  const { absences, assignments, unassignedCount, totalLessons } = summary
  const assignedCount = assignments.filter(a => ['assigned', 'confirmed'].includes(a.status)).length

  return (
    <>
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Icon name="warning" size="sm" className="text-orange-600" />
          </div>
          <div>
            <p className="text-[20px] font-bold text-gray-900 leading-none">{absences.length}</p>
            <p className="text-[11px] text-gray-500">Absence{absences.length !== 1 ? 's' : ''} today</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <Icon name="schedule" size="sm" className="text-red-600" />
          </div>
          <div>
            <p className="text-[20px] font-bold text-gray-900 leading-none">{unassignedCount}</p>
            <p className="text-[11px] text-gray-500">Need cover</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <Icon name="check_circle" size="sm" className="text-green-600" />
          </div>
          <div>
            <p className="text-[20px] font-bold text-gray-900 leading-none">{assignedCount}</p>
            <p className="text-[11px] text-gray-500">Covered of {totalLessons}</p>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-5 min-h-0 flex-1">
        {/* Left: absences */}
        <div className="w-72 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Absences</h2>
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Icon name="add" size="sm" />
              Log Absence
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <AbsenceList
              absences={absences}
              selectedAbsenceId={selectedAbsenceId}
              onSelect={setSelectedAbsenceId}
              onDeleted={handleAbsenceDeleted}
            />
          </div>
        </div>

        {/* Right: assignment grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">
              Cover Assignments
              {selectedAbsenceId && (
                <span className="ml-2 font-normal text-blue-600 normal-case text-[11px]">
                  — filtered by selected absence
                </span>
              )}
            </h2>
            {selectedAbsenceId && (
              <button
                onClick={() => setSelectedAbsenceId(null)}
                className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
              >
                Show all
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <CoverAssignmentGrid
              assignments={assignments}
              absences={absences}
              selectedAbsenceId={selectedAbsenceId}
              schoolId={schoolId}
              date={date}
              onUpdated={refresh}
            />
          </div>
        </div>
      </div>

      {showLogModal && (
        <LogAbsenceModal
          schoolId={schoolId}
          date={date}
          staffList={staffList}
          onClose={() => setShowLogModal(false)}
          onLogged={refresh}
        />
      )}
    </>
  )
}
