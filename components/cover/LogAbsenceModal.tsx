'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { logAbsence, logAbsenceRange } from '@/app/actions/cover'

const REASONS = [
  { value: 'illness',       label: 'Illness'       },
  { value: 'training',      label: 'Training'      },
  { value: 'personal_leave',label: 'Personal leave' },
  { value: 'compassionate', label: 'Compassionate'  },
  { value: 'other',         label: 'Other'         },
]

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type StaffMember = { id: string; firstName: string; lastName: string; title: string | null }

type Props = {
  schoolId:   string
  date:       Date
  staffList:  StaffMember[]
  onClose:    () => void
  onLogged:   () => void
}

export default function LogAbsenceModal({ schoolId, date, staffList, onClose, onLogged }: Props) {
  const [staffId,     setStaffId]     = useState('')
  const [coveredBy,   setCoveredBy]   = useState('')
  const [reason,      setReason]      = useState('illness')
  const [notes,       setNotes]       = useState('')
  const [search,      setSearch]      = useState('')
  const [coverSearch, setCoverSearch] = useState('')
  const [startDate,   setStartDate]   = useState(toInputDate(date))
  const [endDate,     setEndDate]     = useState(toInputDate(date))
  const [error,       setError]       = useState('')
  const [pending,     start]          = useTransition()

  const isRange = startDate !== endDate

  const filtered = staffList.filter(s => {
    const full = `${s.firstName} ${s.lastName}`.toLowerCase()
    return full.includes(search.toLowerCase())
  })

  const coverFiltered = staffList.filter(s => {
    const full = `${s.firstName} ${s.lastName}`.toLowerCase()
    return full.includes(coverSearch.toLowerCase()) && s.id !== staffId
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffId) { setError('Please select a staff member.'); return }
    if (!startDate || !endDate) { setError('Please select a date range.'); return }
    if (startDate > endDate) { setError('End date must be on or after start date.'); return }
    setError('')
    start(async () => {
      if (isRange) {
        await logAbsenceRange(schoolId, {
          staffId,
          startDate: new Date(startDate),
          endDate:   new Date(endDate),
          reason,
          notes:     notes || undefined,
          coveredBy: coveredBy || undefined,
        })
      } else {
        await logAbsence(schoolId, {
          staffId,
          date:      new Date(startDate),
          reason,
          notes:     notes || undefined,
          coveredBy: coveredBy || undefined,
        })
      }
      onLogged()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" aria-label="Log staff absence" className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">Log Absence</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Staff search */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Staff Member
            </label>
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1.5"
            />
            <div className="max-h-44 overflow-auto border border-gray-200 rounded-lg">
              {filtered.length === 0 ? (
                <p className="text-[12px] text-gray-400 px-3 py-2">No staff found.</p>
              ) : (
                filtered.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-gray-100 last:border-0 ${
                      staffId === s.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="staffId"
                      value={s.id}
                      checked={staffId === s.id}
                      onChange={() => setStaffId(s.id)}
                      className="accent-blue-600"
                    />
                    <span className="text-[12px] text-gray-800">
                      {s.title ? `${s.title} ` : ''}{s.firstName} {s.lastName}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  if (e.target.value > endDate) setEndDate(e.target.value)
                }}
                className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                To <span className="font-normal text-gray-300 normal-case">(multi-day)</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          {isRange && (
            <p className="text-[11px] text-blue-600 flex items-center gap-1 -mt-1">
              <Icon name="info" size="sm" />
              Weekdays only — weekends will be skipped automatically.
            </p>
          )}

          {/* Reason */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Reason
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Cover teacher */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Cover Teacher <span className="font-normal text-gray-300 normal-case">(optional — assigns all lessons immediately)</span>
            </label>
            <input
              type="text"
              placeholder="Search cover teacher…"
              value={coverSearch}
              onChange={e => setCoverSearch(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1.5"
            />
            <div className="max-h-32 overflow-auto border border-gray-200 rounded-lg">
              <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-gray-100 ${
                coveredBy === '' ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input
                  type="radio" name="coveredBy" value=""
                  checked={coveredBy === ''}
                  onChange={() => setCoveredBy('')}
                  className="accent-blue-600"
                />
                <span className="text-[12px] text-gray-400 italic">None — assign cover later</span>
              </label>
              {coverFiltered.map(s => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-gray-100 last:border-0 ${
                    coveredBy === s.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio" name="coveredBy" value={s.id}
                    checked={coveredBy === s.id}
                    onChange={() => setCoveredBy(s.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-[12px] text-gray-800">
                    {s.title ? `${s.title} ` : ''}{s.firstName} {s.lastName}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Notes <span className="font-normal text-gray-300 normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional context…"
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12px] text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-[12px] font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {pending ? 'Logging…' : isRange ? 'Log Absence (Range)' : 'Log Absence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
