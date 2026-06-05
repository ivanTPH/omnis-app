'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { EhcpPlanWithOutcomes, SubmissionForEvidence, PendingEvidenceSuggestion } from '@/app/actions/ehcp'
import {
  updateEhcpOutcomeStatus,
  getStudentSubmissionsForEvidence,
  linkSubmissionToEhcpOutcome,
  getPendingEvidenceSuggestions,
  confirmEvidenceSuggestion,
  dismissEvidenceSuggestion,
} from '@/app/actions/ehcp'

type Props = { plan: EhcpPlanWithOutcomes }

const STATUS_COLOURS: Record<string, string> = {
  active:               'bg-blue-100 text-blue-700',
  achieved:             'bg-green-100 text-green-700',
  partially_achieved:   'bg-amber-100 text-amber-700',
  not_achieved:         'bg-red-100 text-red-700',
}

const STATUS_OPTIONS = ['active', 'achieved', 'partially_achieved', 'not_achieved']

export default function EhcpOutcomeTracker({ plan }: Props) {
  const [outcomes,    setOutcomes]    = useState(plan.outcomes)
  const [updatingId,  setUpdatingId]  = useState<string | null>(null)

  // Evidence picker state
  const [evidenceOutcomeId, setEvidenceOutcomeId] = useState<string | null>(null)
  const [submissions,       setSubmissions]       = useState<SubmissionForEvidence[] | null>(null)
  const [loadingSubs,       setLoadingSubs]       = useState(false)
  const [selectedSubId,     setSelectedSubId]     = useState<string | null>(null)
  const [teacherNote,       setTeacherNote]       = useState('')
  const [qualityRating,     setQualityRating]     = useState(3)
  const [linking,           setLinking]           = useState(false)
  const [linkError,         setLinkError]         = useState<string | null>(null)
  const [linkedCounts,      setLinkedCounts]      = useState<Record<string, number>>({}) // outcomeId → count added this session
  const [successFlash,      setSuccessFlash]      = useState<string | null>(null)    // outcomeId that just got evidence linked

  // Status-change prompt: after linking evidence, suggest updating outcome status
  const [statusPrompt,      setStatusPrompt]      = useState<{ outcomeId: string; newCount: number } | null>(null)

  // AI Evidence Agent suggestion queue — auto-load on mount
  const [suggestions,       setSuggestions]       = useState<PendingEvidenceSuggestion[] | null>(null)
  const [suggestionsOpen,   setSuggestionsOpen]   = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [confirmingId,      setConfirmingId]      = useState<string | null>(null)

  // Auto-load suggestions on mount
  useEffect(() => {
    getPendingEvidenceSuggestions(plan.studentId)
      .then(data => {
        setSuggestions(data)
        // Expand automatically when there are pending suggestions
        if (data.length > 0) setSuggestionsOpen(true)
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.studentId])

  async function handleStatusChange(outcomeId: string, status: string) {
    // Soft guardrail: warn if marking achieved with no evidence
    const outcome = outcomes.find(o => o.id === outcomeId)
    if (status === 'achieved' && outcome && outcome.evidenceCount === 0) {
      const confirmed = window.confirm(
        'This outcome has no linked evidence.\n\nAre you sure you want to mark it as achieved?\n\nConsider linking homework evidence first using the "Link evidence" button below.'
      )
      if (!confirmed) return
    }
    setUpdatingId(outcomeId)
    // Dismiss the status prompt if the user acts on it
    if (statusPrompt?.outcomeId === outcomeId) setStatusPrompt(null)
    try {
      await updateEhcpOutcomeStatus(outcomeId, status)
      setOutcomes(prev => prev.map(o => o.id === outcomeId ? { ...o, status } : o))
    } finally {
      setUpdatingId(null)
    }
  }

  async function openEvidencePicker(outcomeId: string) {
    setEvidenceOutcomeId(outcomeId)
    setSelectedSubId(null)
    setTeacherNote('')
    setQualityRating(3)
    setLinkError(null)
    setSuccessFlash(null)
    if (!submissions) {
      setLoadingSubs(true)
      try {
        const subs = await getStudentSubmissionsForEvidence(plan.studentId)
        setSubmissions(subs)
      } finally {
        setLoadingSubs(false)
      }
    }
  }

  async function handleLinkEvidence() {
    if (!evidenceOutcomeId || !selectedSubId) return
    setLinking(true)
    setLinkError(null)
    try {
      const { alreadyLinked } = await linkSubmissionToEhcpOutcome(selectedSubId, evidenceOutcomeId, teacherNote, qualityRating)
      if (alreadyLinked) {
        setLinkError('This submission is already confirmed as evidence for this outcome.')
        return
      }
      const newCount = (outcomes.find(o => o.id === evidenceOutcomeId)?.evidenceCount ?? 0) + 1
      setOutcomes(prev => prev.map(o => o.id === evidenceOutcomeId ? { ...o, evidenceCount: newCount } : o))
      setLinkedCounts(prev => ({ ...prev, [evidenceOutcomeId]: (prev[evidenceOutcomeId] ?? 0) + 1 }))
      // Flash success on the outcome row
      setSuccessFlash(evidenceOutcomeId)
      setTimeout(() => setSuccessFlash(null), 4000)
      // Reset selection so user can immediately pick another submission — keep picker open
      setSelectedSubId(null)
      setTeacherNote('')
      setQualityRating(3)
      // Check if adding this evidence should prompt a status update
      const outcome = outcomes.find(o => o.id === evidenceOutcomeId)
      if (outcome && (outcome.status === 'not_achieved' || outcome.status === 'active') && newCount >= 1) {
        setStatusPrompt({ outcomeId: evidenceOutcomeId, newCount })
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Failed to link evidence. Please try again.')
    } finally {
      setLinking(false)
    }
  }

  async function handleConfirm(evidenceId: string, outcomeId: string) {
    setConfirmingId(evidenceId)
    try {
      await confirmEvidenceSuggestion(evidenceId)
      setSuggestions(prev => prev ? prev.filter(s => s.id !== evidenceId) : prev)
      const newCount = (outcomes.find(o => o.id === outcomeId)?.evidenceCount ?? 0) + 1
      setOutcomes(prev => prev.map(o => o.id === outcomeId ? { ...o, evidenceCount: newCount } : o))
      // Prompt status update after confirming AI suggestion
      const outcome = outcomes.find(o => o.id === outcomeId)
      if (outcome && (outcome.status === 'not_achieved' || outcome.status === 'active')) {
        setStatusPrompt({ outcomeId, newCount })
      }
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleDismiss(evidenceId: string) {
    setConfirmingId(evidenceId)
    try {
      await dismissEvidenceSuggestion(evidenceId)
      setSuggestions(prev => prev ? prev.filter(s => s.id !== evidenceId) : prev)
    } finally {
      setConfirmingId(null)
    }
  }

  const achieved = outcomes.filter(o => o.status === 'achieved').length
  const total = outcomes.length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-green-700">{achieved}</span> of {total} outcomes achieved
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>LA: {plan.localAuthority}</span>
          <span>·</span>
          <span>Review: {new Date(plan.reviewDate).toLocaleDateString('en-GB')}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: total > 0 ? `${Math.round((achieved / total) * 100)}%` : '0%' }}
        />
      </div>

      {/* Outcomes grouped by section */}
      <div className="space-y-3">
        {outcomes.map(outcome => (
          <div key={outcome.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="shrink-0 pt-0.5">
                {outcome.status === 'achieved'
                  ? <Icon name="check_circle" size="md" className="text-green-600" />
                  : <Icon name="circle" size="md" className="text-gray-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">Section {outcome.section}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[outcome.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {outcome.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {outcome.evidenceCount} evidence piece{outcome.evidenceCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    Due {new Date(outcome.targetDate).toLocaleDateString('en-GB')}
                  </span>
                  {successFlash === outcome.id && (
                    <span className="text-xs text-green-700 flex items-center gap-1 font-medium">
                      <Icon name="check_circle" size="sm" />
                      Evidence linked
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 mb-1">{outcome.outcomeText}</p>
                <p className="text-xs text-gray-500">{outcome.successCriteria}</p>
                {outcome.provisionRequired && (
                  <p className="text-xs text-purple-700 mt-1">Provision: {outcome.provisionRequired}</p>
                )}
              </div>
              <div className="shrink-0">
                <select
                  value={outcome.status}
                  onChange={e => handleStatusChange(outcome.id, e.target.value)}
                  disabled={updatingId === outcome.id}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status-change prompt banner */}
            {statusPrompt?.outcomeId === outcome.id && outcome.status !== 'achieved' && (
              <div className="border-t border-green-200 bg-green-50 px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-green-800">
                  <Icon name="auto_awesome" size="sm" className="text-green-600 shrink-0" />
                  <span>
                    <span className="font-semibold">{statusPrompt.newCount} piece{statusPrompt.newCount !== 1 ? 's' : ''} of evidence</span>
                    {' '}linked — should you update the outcome status?
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleStatusChange(outcome.id, 'partially_achieved')}
                    className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium transition-colors"
                  >
                    Partially achieved
                  </button>
                  <button
                    onClick={() => handleStatusChange(outcome.id, 'achieved')}
                    className="text-xs px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors"
                  >
                    Mark achieved
                  </button>
                  <button
                    onClick={() => setStatusPrompt(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              </div>
            )}

            {outcome.status !== 'achieved' && (
              <div className={`border-t border-gray-100 px-4 py-2 ${outcome.evidenceCount === 0 && outcome.status === 'active' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                {evidenceOutcomeId === outcome.id ? (
                  <div className="space-y-3 py-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Link homework evidence to this outcome</p>
                      <button onClick={() => setEvidenceOutcomeId(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                        <Icon name="close" size="sm" />
                        Close
                      </button>
                    </div>
                    {(linkedCounts[outcome.id] ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1.5 rounded-lg">
                        <Icon name="check_circle" size="sm" />
                        {linkedCounts[outcome.id]} piece{(linkedCounts[outcome.id] ?? 0) !== 1 ? 's' : ''} linked this session — select another to add more
                      </div>
                    )}
                    {loadingSubs ? (
                      <p className="text-xs text-gray-400 animate-pulse">Loading submissions…</p>
                    ) : !submissions || submissions.length === 0 ? (
                      <p className="text-xs text-gray-500">No graded submissions found for this student.</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {submissions.map(s => (
                          <button
                            key={s.id}
                            onClick={() => { setSelectedSubId(s.id === selectedSubId ? null : s.id); setLinkError(null) }}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded-lg border transition-colors ${selectedSubId === s.id ? 'border-purple-400 bg-purple-50 text-purple-900' : 'border-gray-200 hover:bg-gray-100 text-gray-700'}`}
                          >
                            <span className="font-medium">{s.homeworkTitle}</span>
                            {s.subject && <span className="text-gray-400"> · {s.subject}</span>}
                            {s.finalScore != null && <span className="ml-1 font-semibold text-purple-700">Gr {Math.round(s.finalScore)}</span>}
                            {s.submittedAt && <span className="text-gray-400 ml-1">· {new Date(s.submittedAt).toLocaleDateString('en-GB')}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedSubId && (
                      <div className="space-y-2">
                        <textarea
                          value={teacherNote}
                          onChange={e => setTeacherNote(e.target.value)}
                          rows={2}
                          placeholder="Evidence note — optional but recommended…"
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Quality:</span>
                          {[1, 2, 3, 4, 5].map(r => (
                            <button key={r} onClick={() => setQualityRating(r)} className={`text-sm ${r <= qualityRating ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
                          ))}
                        </div>
                        {linkError && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <Icon name="error" size="sm" />
                            {linkError}
                          </p>
                        )}
                        <button
                          onClick={handleLinkEvidence}
                          disabled={linking}
                          className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="link" size="sm" />
                          {linking ? 'Linking…' : 'Link evidence'}
                        </button>
                      </div>
                    )}
                    {!selectedSubId && submissions && submissions.length > 0 && (
                      <p className="text-xs text-gray-400">Select a submission above to link it as evidence.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEvidencePicker(outcome.id)}
                      className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-medium"
                    >
                      <Icon name="add_link" size="sm" />
                      {outcome.evidenceCount === 0 ? 'Link evidence from homework' : `Add more evidence (${outcome.evidenceCount} linked)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {outcomes.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Icon name="description" size="lg" className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No outcomes recorded for this EHCP plan.</p>
        </div>
      )}

      {/* AI Evidence Agent suggestion queue — auto-loads on mount */}
      <div className="border border-purple-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setSuggestionsOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 text-sm font-medium text-purple-800 hover:bg-purple-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon name="auto_awesome" size="sm" className="text-purple-600" />
            <span>AI Evidence Suggestions</span>
            {suggestionsLoading && (
              <Icon name="refresh" size="sm" className="text-purple-400 animate-spin" />
            )}
            {suggestions != null && suggestions.length > 0 && (
              <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                {suggestions.length}
              </span>
            )}
            {suggestions != null && suggestions.length === 0 && !suggestionsLoading && (
              <span className="text-xs text-purple-400">No pending suggestions</span>
            )}
          </div>
          <Icon
            name="chevron_right"
            size="sm"
            className={`text-purple-500 transition-transform ${suggestionsOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {suggestionsOpen && (
          <div className="border-t border-purple-100 bg-white p-4">
            {suggestionsLoading ? (
              <p className="text-xs text-gray-400 animate-pulse">Checking for AI-suggested evidence…</p>
            ) : !suggestions || suggestions.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <Icon name="check_circle" size="sm" className="text-green-500" />
                No pending suggestions — the AI Evidence Agent will scan new submissions automatically.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-purple-700 font-medium">
                  The Evidence Agent found {suggestions.length} potential evidence link{suggestions.length !== 1 ? 's' : ''} from recent homework. Review and confirm or dismiss each.
                </p>
                <div className="space-y-2">
                  {suggestions.map(s => (
                    <div key={s.id} className="border border-purple-100 rounded-lg p-3 bg-purple-50 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-purple-900">
                            Section {s.section}: {s.outcomeText.slice(0, 100)}{s.outcomeText.length > 100 ? '…' : ''}
                          </p>
                          <p className="text-xs text-gray-700 mt-0.5">
                            <span className="font-medium">&ldquo;{s.homeworkTitle}&rdquo;</span>
                            {s.subject && <span className="text-gray-500"> · {s.subject}</span>}
                            {s.grade != null && <span className="ml-1 font-semibold text-purple-700"> · Gr {Math.round(s.grade)}</span>}
                            {s.submittedAt && <span className="text-gray-400 ml-1">· {new Date(s.submittedAt).toLocaleDateString('en-GB')}</span>}
                          </p>
                          {s.teacherNote && (
                            <p className="text-xs text-gray-500 italic mt-1">&ldquo;{s.teacherNote}&rdquo;</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          onClick={() => handleConfirm(s.id, s.outcomeId)}
                          disabled={confirmingId === s.id}
                          className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="check" size="sm" />
                          {confirmingId === s.id ? 'Confirming…' : 'Confirm evidence'}
                        </button>
                        <button
                          onClick={() => handleDismiss(s.id)}
                          disabled={confirmingId === s.id}
                          className="flex items-center gap-1 text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="close" size="sm" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
