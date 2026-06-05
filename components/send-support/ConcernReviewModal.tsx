'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { ConcernRow } from '@/app/actions/send-support'
import { reviewConcern, requestAiAnalysis, generateILPFromConcern } from '@/app/actions/send-support'
import { CategoryBadge } from './ConcernList'

const STATUSES = [
  { value: 'under_review', label: 'Under Review',               needsReviewDate: true  },
  { value: 'monitoring',   label: 'Monitoring',                  needsReviewDate: true  },
  { value: 'escalated',    label: 'Escalated',                   needsReviewDate: true  },
  { value: 'closed',       label: 'Closed — Action Taken',       needsReviewDate: false },
  { value: 'no_action',    label: 'Closed — No Action Required', needsReviewDate: false },
]

type Props = {
  concern:   ConcernRow
  onClose:   () => void
  staffList?: { id: string; name: string; role: string }[]
}

function minDate() {
  return new Date().toISOString().split('T')[0]
}

export default function ConcernReviewModal({ concern, onClose, staffList = [] }: Props) {
  const [status,         setStatus]         = useState(concern.status !== 'open' ? concern.status : 'under_review')
  const [reviewNotes,    setReviewNotes]     = useState(concern.reviewNotes ?? '')
  const [aiAnalysis,     setAiAnalysis]      = useState(concern.aiAnalysis ?? '')
  const [loadingAi,      setLoadingAi]       = useState(false)
  const [generatingIlp,  setGeneratingIlp]   = useState(false)
  const [ilpGenerated,   setIlpGenerated]    = useState(false)
  const [ilpError,       setIlpError]        = useState<string | null>(null)
  const [saving,         setSaving]          = useState(false)
  const [error,          setError]           = useState<string | null>(null)
  const [savedWithIlp,   setSavedWithIlp]    = useState(false)
  const [nextReviewDate, setNextReviewDate]  = useState(
    concern.nextReviewDate ? new Date(concern.nextReviewDate).toISOString().split('T')[0] : ''
  )
  const [assignedToId,   setAssignedToId]   = useState(concern.assignedToId ?? '')
  const [assignedAction, setAssignedAction] = useState(concern.assignedAction ?? '')
  const [showAssign,     setShowAssign]      = useState(!!concern.assignedToId)

  const statusMeta = STATUSES.find(s => s.value === status)
  const isClosing  = ['closed', 'no_action'].includes(status)

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

  async function handleGenerateIlp() {
    setGeneratingIlp(true)
    setIlpError(null)
    try {
      const result = await generateILPFromConcern(concern.id)
      if (result.success) {
        setIlpGenerated(true)
      } else {
        setIlpError(result.error ?? 'Generation failed')
      }
    } catch {
      setIlpError('Generation failed — please try again.')
    } finally {
      setGeneratingIlp(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewNotes.trim()) { setError('Please add review notes'); return }
    if (statusMeta?.needsReviewDate && !isClosing && !nextReviewDate) {
      setError('Please set a follow-up review date'); return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await reviewConcern(concern.id, status, reviewNotes, {
        nextReviewDate:  isClosing ? null : (nextReviewDate || null),
        assignedToId:    showAssign && assignedToId ? assignedToId : null,
        assignedAction:  showAssign && assignedToId ? assignedAction : null,
      })
      if (result.ilpGenerated) {
        setSavedWithIlp(true)
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  // Teachable staff for assignment (exclude STUDENT/PARENT roles)
  const assignableStaff = staffList.filter(s => !['STUDENT', 'PARENT'].includes(s.role))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
          <div>
            <h2 className="font-semibold text-gray-900">Review SEND Concern</h2>
            <p className="text-xs text-gray-500 mt-0.5">{concern.studentName} · <CategoryBadge category={concern.category} /></p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="close" size="md" /></button>
        </div>

        {savedWithIlp && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="check_circle" size="lg" className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Concern saved &amp; ILP auto-generated</p>
              <p className="text-sm text-gray-500 mt-1">A draft ILP has been created for {concern.studentName} based on this concern. Review and activate it in the ILP records.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/senco/ilp" className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                View ILP Records
              </Link>
              <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-200 rounded-lg text-sm">
                Close
              </button>
            </div>
          </div>
        )}

        {!savedWithIlp && <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                {loadingAi ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="smart_toy" size="sm" />}
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

          {/* Auto-ILP notice when escalating */}
          {status === 'escalated' && !concern.hasActiveIlp && (
            <div className="flex items-start gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              <Icon name="auto_awesome" size="sm" className="text-green-600 shrink-0 mt-0.5" />
              <p>Saving as <strong>Escalated</strong> will automatically generate a draft ILP for {concern.studentName} using AI.</p>
            </div>
          )}

          {/* Generate ILP from concern — shown for non-escalated statuses only */}
          {!concern.hasActiveIlp && !['closed', 'no_action'].includes(concern.status) && status !== 'escalated' && (
            <div className="rounded-xl border border-green-200 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 flex items-center gap-2">
                <Icon name="description" size="sm" className="text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">Generate ILP from this concern</p>
                  <p className="text-xs text-green-700 mt-0.5">AI will create a draft ILP with targets tailored to the concern description and evidence above.</p>
                </div>
              </div>
              <div className="px-4 py-3 bg-white">
                {ilpGenerated ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <Icon name="check_circle" size="sm" />
                    <span className="text-sm font-medium">ILP created and ready for review.</span>
                    <Link href="/senco/ilp" className="ml-auto text-xs text-green-600 hover:underline font-medium">View ILP →</Link>
                  </div>
                ) : (
                  <>
                    {ilpError && <p className="text-xs text-red-600 mb-2">{ilpError}</p>}
                    <button
                      type="button"
                      onClick={handleGenerateIlp}
                      disabled={generatingIlp}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {generatingIlp
                        ? <><Icon name="refresh" size="sm" className="animate-spin" /> Generating ILP…</>
                        : <><Icon name="auto_awesome" size="sm" /> Generate ILP</>
                      }
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Status select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update status *</label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); if (['closed','no_action'].includes(e.target.value)) setNextReviewDate('') }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Follow-up review date — shown when concern stays open */}
          {!isClosing && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="event" size="sm" className="text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-900">Follow-up Review Date</p>
                <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">Required</span>
              </div>
              <p className="text-xs text-amber-700">Set the date by which this concern must be reviewed again. A follow-up reminder will appear in the SENCO dashboard when the date approaches.</p>
              <input
                type="date"
                value={nextReviewDate}
                min={minDate()}
                onChange={e => setNextReviewDate(e.target.value)}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                required={!isClosing}
              />
            </div>
          )}

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

          {/* Assign to teacher */}
          <div className="rounded-xl border border-indigo-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAssign(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-indigo-50 text-left hover:bg-indigo-100 transition"
            >
              <Icon name="person_add" size="sm" className="text-indigo-600 shrink-0" />
              <span className="text-sm font-medium text-indigo-900">
                {showAssign ? 'Hide teacher assignment' : 'Assign to a teacher with action suggestion'}
              </span>
              {concern.assignedToName && !showAssign && (
                <span className="ml-auto text-xs text-indigo-600">Currently: {concern.assignedToName}</span>
              )}
              <Icon name={showAssign ? 'expand_less' : 'expand_more'} size="sm" className="ml-auto text-indigo-400" />
            </button>

            {showAssign && (
              <div className="p-4 space-y-3 bg-white">
                <p className="text-xs text-gray-500">Select a teacher to notify. They will receive a notification with your action suggestion and can see this concern in their SEND panel.</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
                  <select
                    value={assignedToId}
                    onChange={e => setAssignedToId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Select staff member —</option>
                    {assignableStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role.replace(/_/g,' ')})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Action suggestion</label>
                  <textarea
                    value={assignedAction}
                    onChange={e => setAssignedAction(e.target.value)}
                    rows={3}
                    placeholder="e.g. Please monitor reading comprehension this week and report back with observations. Consider using pre-teaching vocabulary before Wednesday's lesson."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">This message will be sent directly to the teacher via notification.</p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Review'}
            </button>
          </div>
        </form>}
      </div>
    </div>
  )
}
