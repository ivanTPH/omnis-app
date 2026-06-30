'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import type { StudentOption } from '@/app/actions/gdpr'
import { submitDataSubjectRequest } from '@/app/actions/gdpr'

const REQUEST_TYPES = [
  { value: 'access',        label: 'Subject Access Request (Article 15)' },
  { value: 'erasure',       label: 'Right to Erasure (Article 17)' },
  { value: 'rectification', label: 'Rectification (Article 16)' },
  { value: 'portability',   label: 'Data Portability (Article 20)' },
]

type Props = {
  students: StudentOption[]
  onClose: () => void
}

export default function NewDsrModal({ students, onClose }: Props) {
  const [studentId, setStudentId]   = useState('')
  const [requestType, setType]      = useState('erasure')
  const [notes, setNotes]           = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [pending, startTransition]  = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        await submitDataSubjectRequest(studentId || null, requestType, notes)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit request')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="New data subject request" className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-900">New Data Subject Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Icon name="close" size="md" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
              Request type
            </label>
            <select
              value={requestType}
              onChange={e => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REQUEST_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
              Student (optional — leave blank for staff requests)
            </label>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No specific student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.lastName}, {s.firstName}{s.yearGroup ? ` (Y${s.yearGroup})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Details of the request, date received, requester name..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {requestType === 'erasure' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-[12px] text-amber-800">
              <strong>Erasure requests</strong> must be reviewed before execution. Once logged here, use the &ldquo;Execute erasure&rdquo; button on the request row to carry out the deletion — this cannot be undone.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="px-4 py-2 text-[13px] font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? 'Submitting…' : 'Log request'}
          </button>
        </div>
      </div>
    </div>
  )
}
