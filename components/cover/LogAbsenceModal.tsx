'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { logAbsence } from '@/app/actions/cover'

const REASONS = [
  { value: 'illness',  label: 'Illness'  },
  { value: 'training', label: 'Training' },
  { value: 'personal', label: 'Personal' },
  { value: 'other',    label: 'Other'    },
]

type StaffMember = { id: string; firstName: string; lastName: string; title: string | null }

type Props = {
  schoolId:   string
  date:       Date
  staffList:  StaffMember[]
  onClose:    () => void
  onLogged:   () => void
}

export default function LogAbsenceModal({ schoolId, date, staffList, onClose, onLogged }: Props) {
  const [staffId,  setStaffId]  = useState('')
  const [reason,   setReason]   = useState('illness')
  const [notes,    setNotes]    = useState('')
  const [search,   setSearch]   = useState('')
  const [error,    setError]    = useState('')
  const [pending,  start]       = useTransition()

  const filtered = staffList.filter(s => {
    const full = `${s.firstName} ${s.lastName}`.toLowerCase()
    return full.includes(search.toLowerCase())
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffId) { setError('Please select a staff member.'); return }
    setError('')
    start(async () => {
      await logAbsence(schoolId, { staffId, date, reason, notes: notes || undefined })
      onLogged()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">Log Absence</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
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

          {/* Date (read-only — uses the dashboard's selected date) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Date
            </label>
            <p className="text-[12px] text-gray-700 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
              {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

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
              {pending ? 'Logging…' : 'Log Absence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
