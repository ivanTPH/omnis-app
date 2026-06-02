'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { EhcpPlanWithOutcomes, SubmissionForEvidence } from '@/app/actions/ehcp'
import { updateEhcpOutcomeStatus, getStudentSubmissionsForEvidence, linkSubmissionToEhcpOutcome } from '@/app/actions/ehcp'

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
  const [linked,            setLinked]            = useState<string | null>(null) // last-linked outcomeId for feedback

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
    try {
      await linkSubmissionToEhcpOutcome(selectedSubId, evidenceOutcomeId, teacherNote, qualityRating)
      setOutcomes(prev => prev.map(o => o.id === evidenceOutcomeId ? { ...o, evidenceCount: o.evidenceCount + 1 } : o))
      setLinked(evidenceOutcomeId)
      setEvidenceOutcomeId(null)
      setSelectedSubId(null)
      setTeacherNote('')
      setTimeout(() => setLinked(null), 3000)
    } finally {
      setLinking(false)
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

            {outcome.status === 'active' && (
              <div className={`border-t border-gray-100 px-4 py-2 ${outcome.evidenceCount === 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                {evidenceOutcomeId === outcome.id ? (
                  <div className="space-y-3 py-1">
                    <p className="text-xs font-semibold text-gray-700">Link homework evidence to this outcome</p>
                    {loadingSubs ? (
                      <p className="text-xs text-gray-400 animate-pulse">Loading submissions…</p>
                    ) : !submissions || submissions.length === 0 ? (
                      <p className="text-xs text-gray-500">No graded submissions found for this student.</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {submissions.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSubId(s.id === selectedSubId ? null : s.id)}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded-lg border transition-colors ${selectedSubId === s.id ? 'border-purple-400 bg-purple-50 text-purple-900' : 'border-gray-200 hover:bg-gray-100 text-gray-700'}`}
                          >
                            <span className="font-medium">{s.homeworkTitle}</span>
                            {s.subject && <span className="text-gray-400"> · {s.subject}</span>}
                            {s.grade && <span className="ml-1 font-semibold text-purple-700">Gr {s.grade}</span>}
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
                          placeholder="Evidence note (optional)…"
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Quality:</span>
                          {[1, 2, 3, 4, 5].map(r => (
                            <button key={r} onClick={() => setQualityRating(r)} className={`text-sm ${r <= qualityRating ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleLinkEvidence}
                        disabled={!selectedSubId || linking}
                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
                      >
                        <Icon name="link" size="sm" />
                        {linking ? 'Linking…' : 'Link evidence'}
                      </button>
                      <button onClick={() => setEvidenceOutcomeId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  </div>
                ) : linked === outcome.id ? (
                  <p className="text-xs text-green-700 flex items-center gap-1">
                    <Icon name="check_circle" size="sm" /> Evidence linked successfully
                  </p>
                ) : (
                  <button
                    onClick={() => openEvidencePicker(outcome.id)}
                    className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium"
                  >
                    <Icon name="add" size="sm" />
                    {outcome.evidenceCount === 0 ? 'Link evidence from homework' : `Add more evidence (${outcome.evidenceCount} linked)`}
                  </button>
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
    </div>
  )
}
