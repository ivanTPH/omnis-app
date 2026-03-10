'use client'

import { useState } from 'react'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { raiseConcern } from '@/app/actions/send-support'

const CATEGORIES = [
  { value: 'literacy',         label: 'Literacy' },
  { value: 'numeracy',         label: 'Numeracy' },
  { value: 'behaviour',        label: 'Behaviour' },
  { value: 'attendance',       label: 'Attendance' },
  { value: 'social_emotional', label: 'Social & Emotional' },
  { value: 'communication',    label: 'Communication' },
  { value: 'physical',         label: 'Physical' },
  { value: 'sensory',          label: 'Sensory' },
  { value: 'other',            label: 'Other' },
]

type Props = {
  studentId: string
  studentName: string
  onClose: () => void
}

export default function RaiseConcernModal({ studentId, studentName, onClose }: Props) {
  const [category,      setCategory]      = useState('')
  const [description,   setDescription]   = useState('')
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [done,          setDone]          = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!category) { setError('Please select a category'); return }
    setSubmitting(true)
    try {
      await raiseConcern({ studentId, category, description, evidenceNotes: evidenceNotes || undefined })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to raise concern')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Raise SEND Concern</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
            <p className="font-medium text-gray-900">Concern raised</p>
            <p className="text-sm text-gray-500 mt-1">The SENCO has been notified about {studentName}.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-3">Raising concern about: <strong>{studentName}</strong></p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This concern will be reviewed by the SENCO. It is a professional observation, not a diagnosis.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description of concern *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what you have observed…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                required
                minLength={10}
                maxLength={1000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Evidence / specific observations (optional)</label>
              <textarea
                value={evidenceNotes}
                onChange={e => setEvidenceNotes(e.target.value)}
                rows={2}
                placeholder="Specific dates, examples, or data points…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                maxLength={500}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? 'Raising concern…' : 'Raise Concern'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
