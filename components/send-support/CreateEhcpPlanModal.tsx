'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createEhcpPlan } from '@/app/actions/ehcp'
import type { StudentWithoutEhcp } from '@/app/actions/ehcp'

type Props = {
  students: StudentWithoutEhcp[]
  onClose: () => void
}

function defaultReviewDate(planDate: string): string {
  if (!planDate) return ''
  const d = new Date(planDate)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export default function CreateEhcpPlanModal({ students, onClose }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [studentId,       setStudentId]       = useState('')
  const [localAuthority,  setLocalAuthority]  = useState('')
  const [coordinatorName, setCoordinatorName] = useState('')
  const [planDate,        setPlanDate]        = useState(() => new Date().toISOString().slice(0, 10))
  const [reviewDate,      setReviewDate]      = useState(() => defaultReviewDate(new Date().toISOString().slice(0, 10)))
  const [outcomeText,     setOutcomeText]     = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [outcomeSection,  setOutcomeSection]  = useState('Health')
  const [outcomeTarget,   setOutcomeTarget]   = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10)
  })
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const canSave = !!studentId && !!localAuthority && !!planDate && !!reviewDate && !!outcomeText && !!successCriteria

  function handlePlanDateChange(val: string) {
    setPlanDate(val)
    setReviewDate(defaultReviewDate(val))
  }

  function handleSubmit() {
    if (!canSave) return
    setSaving(true); setError('')
    startTransition(async () => {
      try {
        await createEhcpPlan({
          studentId,
          localAuthority,
          coordinatorName: coordinatorName || undefined,
          planDate:        new Date(planDate),
          reviewDate:      new Date(reviewDate),
          outcomes: [{
            section:         outcomeSection,
            outcomeText,
            successCriteria,
            targetDate:      new Date(outcomeTarget),
            provisionRequired: undefined,
          }],
        })
        router.refresh()
        onClose()
      } catch (e) {
        setError((e as Error).message ?? 'Failed to create EHCP plan')
        setSaving(false)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="New EHCP Plan"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
          <div>
            <h2 className="font-semibold text-gray-900">New EHCP Plan</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">Creates plan document and updates SEND register to EHCP</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100">
            <Icon name="close" size="md" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Student */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Student *</label>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a student…</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.studentName}{s.yearGroup ? ` (Y${s.yearGroup})` : ''} — {s.needArea ?? s.sendStatus}
                </option>
              ))}
            </select>
            {students.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">All SEND-registered students already have EHCP plan documents.</p>
            )}
          </div>

          {/* Local authority + coordinator */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Local Authority *</label>
              <input
                type="text"
                value={localAuthority}
                onChange={e => setLocalAuthority(e.target.value)}
                placeholder="e.g. Birmingham City Council"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">SEND Coordinator</label>
              <input
                type="text"
                value={coordinatorName}
                onChange={e => setCoordinatorName(e.target.value)}
                placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Plan Date *</label>
              <input
                type="date"
                value={planDate}
                onChange={e => handlePlanDateChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Annual Review Date *</label>
              <input
                type="date"
                value={reviewDate}
                onChange={e => setReviewDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Initial outcome */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
            <p className="text-[12px] font-semibold text-indigo-800">Initial Outcome (required — add more after saving)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Section</label>
                <select
                  value={outcomeSection}
                  onChange={e => setOutcomeSection(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  {['Communication & Interaction', 'Cognition & Learning', 'Social, Emotional & Mental Health', 'Sensory & Physical', 'Health', 'Education', 'Social Care'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Target Date</label>
                <input
                  type="date"
                  value={outcomeTarget}
                  onChange={e => setOutcomeTarget(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Outcome *</label>
              <textarea
                rows={2}
                value={outcomeText}
                onChange={e => setOutcomeText(e.target.value)}
                placeholder="Describe the desired outcome…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Success Criteria *</label>
              <textarea
                rows={2}
                value={successCriteria}
                onChange={e => setSuccessCriteria(e.target.value)}
                placeholder="How will we know this outcome has been achieved?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSave || saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving
                ? <><Icon name="refresh" size="sm" className="animate-spin" />Creating…</>
                : <><Icon name="fact_check" size="sm" />Create EHCP Plan</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
