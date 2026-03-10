'use client'

import { useState } from 'react'
import { X, Bot, Loader2 } from 'lucide-react'
import type { ConcernRow } from '@/app/actions/send-support'
import { reviewConcern, requestAiAnalysis } from '@/app/actions/send-support'
import { CategoryBadge } from './ConcernList'

const STATUSES = [
  { value: 'under_review', label: 'Under Review' },
  { value: 'monitoring',   label: 'Monitoring' },
  { value: 'escalated',    label: 'Escalated' },
  { value: 'closed',       label: 'Closed — Action Taken' },
  { value: 'no_action',    label: 'Closed — No Action Required' },
]

type Props = {
  concern: ConcernRow
  onClose: () => void
}

export default function ConcernReviewModal({ concern, onClose }: Props) {
  const [status,      setStatus]      = useState(concern.status !== 'open' ? concern.status : 'under_review')
  const [reviewNotes, setReviewNotes] = useState(concern.reviewNotes ?? '')
  const [aiAnalysis,  setAiAnalysis]  = useState(concern.aiAnalysis ?? '')
  const [loadingAi,   setLoadingAi]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleAiAnalysis() {
    setLoadingAi(true)
    try {
      const result = await requestAiAnalysis(concern.id)
      setAiAnalysis(result)
    } catch {
      setError('AI analysis failed. Please try again.')
    } finally {
      setLoadingAi(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewNotes.trim()) { setError('Please add review notes'); return }
    setSaving(true)
    setError(null)
    try {
      await reviewConcern(concern.id, status, reviewNotes)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
          <div>
            <h2 className="font-semibold text-gray-900">Review SEND Concern</h2>
            <p className="text-xs text-gray-500 mt-0.5">{concern.studentName} · <CategoryBadge category={concern.category} /></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Concern details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500">Description</p>
              <p className="text-sm text-gray-800 mt-1">{concern.description}</p>
            </div>
            {concern.evidenceNotes && (
              <div>
                <p className="text-xs font-medium text-gray-500">Evidence</p>
                <p className="text-sm text-gray-800 mt-1">{concern.evidenceNotes}</p>
              </div>
            )}
            <p className="text-xs text-gray-400">
              Raised by {concern.raiserName} · {new Date(concern.createdAt).toLocaleDateString('en-GB')}
            </p>
          </div>

          {/* AI analysis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">AI-assisted pattern analysis</p>
              <button
                type="button"
                onClick={handleAiAnalysis}
                disabled={loadingAi}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-medium"
              >
                {loadingAi ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                {aiAnalysis ? 'Refresh Analysis' : 'Request AI Analysis'}
              </button>
            </div>
            {aiAnalysis ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No AI analysis yet. Click above to generate one.</p>
            )}
          </div>

          {/* Status select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update status *</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Review notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review notes *</label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              rows={4}
              placeholder="Summarise your findings and any actions taken or planned…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
