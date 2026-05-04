'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { EarlyWarningFlagRow } from '@/app/actions/send-support'

const FLAG_TYPE_LABELS: Record<string, string> = {
  completion_drop:   'Completion Drop',
  score_decline:     'Score Decline',
  multiple_concerns: 'Multiple Concerns',
  pattern_absence:   'Missed Homeworks',
  homework_decline:  'Homework Decline',
}

const ACTION_TYPES = [
  { value: 'notify_teachers',  label: 'Notify class teachers' },
  { value: 'schedule_meeting', label: 'Schedule SENCO meeting' },
  { value: 'refer_external',   label: 'Refer for external support' },
  { value: 'monitor',          label: 'Monitor — no action needed' },
  { value: 'other',            label: 'Other' },
]

const SEVERITY_BADGE_CLS: Record<string, string> = {
  high:   'badge-high',
  medium: 'badge-medium',
  low:    'badge-low',
}

type Props = {
  flag: EarlyWarningFlagRow
  onClose: () => void
  onResolve: (params: {
    flagId: string
    actionType: string
    notes: string
    notifyTeachers: boolean
  }) => Promise<{ success: boolean; actionedByName?: string; error?: string }>
  onResolved: (result: { actionType: string; notes: string; actionedByName: string }) => void
}

export default function EarlyWarningActionSlideOver({ flag, onClose, onResolve, onResolved }: Props) {
  const [actionType,      setActionType]      = useState('notify_teachers')
  const [notes,           setNotes]           = useState('')
  const [notifyTeachers,  setNotifyTeachers]  = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  async function handleResolve() {
    setSaving(true)
    setError(null)
    try {
      const result = await onResolve({
        flagId: flag.id,
        actionType,
        notes,
        notifyTeachers: actionType === 'notify_teachers' ? notifyTeachers : false,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      onResolved({ actionType, notes, actionedByName: result.actionedByName ?? 'SENCO' })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{flag.studentName}</span>
              <span className={`inline-flex items-center whitespace-nowrap ${SEVERITY_BADGE_CLS[flag.severity] ?? 'badge-open'}`}>
                {flag.severity}
              </span>
              <span className="badge-open">
                {FLAG_TYPE_LABELS[flag.flagType] ?? flag.flagType.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-meta mt-0.5">
              Detected {new Date(flag.createdAt).toLocaleDateString('en-GB')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-3 shrink-0 mt-0.5"
          >
            <Icon name="close" size="md" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Section A — Evidence */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Evidence
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{flag.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <Link
                href={`/student/${flag.studentId}/send`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <Icon name="person_search" size="sm" /> View SEND record
              </Link>
              <Link
                href={`/analytics?student=${flag.studentId}`}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline"
              >
                <Icon name="bar_chart" size="sm" /> Homework &amp; scores
              </Link>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Section B — Take Action */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Take Action
            </h3>
            <p className="text-xs text-gray-500 mb-2">What action are you taking?</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {ACTION_TYPES.map(at => (
                <button
                  key={at.value}
                  type="button"
                  onClick={() => setActionType(at.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    actionType === at.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {at.label}
                </button>
              ))}
            </div>

            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about the action taken or planned..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {actionType === 'notify_teachers' && (
              <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyTeachers}
                  onChange={e => setNotifyTeachers(e.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span className="text-xs text-gray-600">
                  Send notification to all teachers who teach this student
                </span>
              </label>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Section C — Mark Complete */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Mark Complete
            </h3>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleResolve}
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving
                ? <><Icon name="refresh" size="sm" className="animate-spin" /> Saving…</>
                : <><Icon name="check_circle" size="sm" /> Mark as actioned</>
              }
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center leading-relaxed">
              This will notify the class teacher that the flag has been reviewed and actioned.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
