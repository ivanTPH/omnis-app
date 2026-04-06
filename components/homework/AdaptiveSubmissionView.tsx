'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { StudentLearningProfileData, AdaptiveHomeworkSuggestions } from '@/app/actions/adaptive-learning'
import { getStudentLearningProfile, getAdaptiveHomeworkSuggestions } from '@/app/actions/adaptive-learning'
import { linkSubmissionToEhcpOutcome, linkHomeworkToIlpTarget } from '@/app/actions/ehcp'
import { gradeLabel, percentToGcseGrade } from '@/lib/grading'
import { formatRawScore } from '@/lib/gradeUtils'

type Submission = {
  id: string
  studentId: string
  studentName: string
  answer: string | null
  structuredResponse: unknown
  finalScore: number | null
  autoScore: number | null
  teacherScore: number | null
  feedback: string | null
  status: string
  timeSpentMins: number | null
  selfAssessment: number | null
}

type EhcpOutcome = {
  id: string
  section: string
  outcomeText: string
  status: string
}

type IlpTargetForLinking = {
  id: string
  target: string
  targetDate: Date
  strategy: string
}

type Props = {
  submission: Submission
  homeworkId: string
  ehcpOutcomes?: EhcpOutcome[]
  ilpTargetsDue?: IlpTargetForLinking[]
}

export default function AdaptiveSubmissionView({ submission, homeworkId, ehcpOutcomes = [], ilpTargetsDue = [] }: Props) {
  const [profile, setProfile] = useState<StudentLearningProfileData | null>(null)
  const [suggestions, setSuggestions] = useState<AdaptiveHomeworkSuggestions | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [linkingOutcome, setLinkingOutcome] = useState<string | null>(null)
  const [linkedOutcomes, setLinkedOutcomes] = useState<Set<string>>(new Set())
  const [linkingIlpTarget, setLinkingIlpTarget] = useState<string | null>(null)
  const [linkedIlpTargets, setLinkedIlpTargets] = useState<Set<string>>(new Set())
  const [showEvidence, setShowEvidence] = useState(false)
  const [expandProfile, setExpandProfile] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    Promise.all([
      getStudentLearningProfile(submission.studentId),
      getAdaptiveHomeworkSuggestions(submission.studentId, homeworkId),
    ]).then(([p, s]) => {
      setProfile(p)
      setSuggestions(s)
    }).catch(() => {}).finally(() => setLoadingProfile(false))
  }, [submission.studentId, homeworkId])

  async function handleLinkEhcp(outcomeId: string) {
    setLinkingOutcome(outcomeId)
    try {
      await linkSubmissionToEhcpOutcome(submission.id, outcomeId, note || 'Linked from marking view', 3)
      setLinkedOutcomes(prev => new Set([...prev, outcomeId]))
    } catch (e) {
      console.error(e)
    } finally {
      setLinkingOutcome(null)
    }
  }

  async function handleLinkIlpTarget(targetId: string) {
    setLinkingIlpTarget(targetId)
    try {
      await linkHomeworkToIlpTarget(homeworkId, targetId, `Evidence from submission by ${submission.studentName}`)
      setLinkedIlpTargets(prev => new Set([...prev, targetId]))
    } catch (e) {
      console.error(e)
    } finally {
      setLinkingIlpTarget(null)
    }
  }

  const scoreDisplay = submission.finalScore ?? submission.autoScore ?? null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Main submission panel */}
      <div className="xl:col-span-2 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{submission.studentName}</h3>
            <p className="text-sm text-gray-500">
              {submission.timeSpentMins != null && `${submission.timeSpentMins} min · `}
              Status: <span className="capitalize">{submission.status.toLowerCase().replace(/_/g, ' ')}</span>
            </p>
          </div>
          {scoreDisplay !== null && (
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700">{formatRawScore(scoreDisplay)}</div>
              <div className="text-xs text-gray-400">{submission.autoScore != null ? 'Auto-marked' : 'Teacher scored'}</div>
            </div>
          )}
        </div>

        {/* Self-assessment */}
        {submission.selfAssessment != null && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Icon name="star" size="sm" className="text-amber-500" />
            <span>Self-assessment: </span>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < submission.selfAssessment! ? 'text-amber-400' : 'text-gray-300'}>★</span>
            ))}
          </div>
        )}

        {/* Response */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Student response</h4>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {submission.answer ?? <span className="text-gray-400 italic">No response submitted</span>}
          </div>
        </div>

        {/* Feedback */}
        {submission.feedback && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Feedback</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 whitespace-pre-wrap">
              {submission.feedback}
            </div>
          </div>
        )}

        {/* AI Suggestions */}
        {suggestions && (suggestions.adaptations.length > 0 || suggestions.scaffolding.length > 0 || suggestions.ilpAlignments.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <Icon name="lightbulb" size="sm" />
              AI Adaptive Suggestions
            </div>
            {suggestions.adaptations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Adaptations</p>
                <ul className="space-y-1">
                  {suggestions.adaptations.map((a, i) => (
                    <li key={i} className="text-xs text-amber-800">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestions.scaffolding.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Scaffolding</p>
                <ul className="space-y-1">
                  {suggestions.scaffolding.map((s, i) => (
                    <li key={i} className="text-xs text-amber-800">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestions.ilpAlignments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">ILP targets addressed</p>
                <ul className="space-y-1">
                  {suggestions.ilpAlignments.map((a, i) => (
                    <li key={i} className="text-xs text-amber-800">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestions.alternativeType && (
              <p className="text-xs text-amber-700">Suggested alternative type: <strong>{suggestions.alternativeType.replace(/_/g, ' ')}</strong></p>
            )}
          </div>
        )}

        {/* Link as Evidence — ILP + EHCP combined */}
        {(ilpTargetsDue.length > 0 || ehcpOutcomes.length > 0) && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowEvidence(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Icon name="link" size="sm" className="text-purple-600" />
                Link as Evidence
                {(linkedIlpTargets.size > 0 || linkedOutcomes.size > 0) && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    {linkedIlpTargets.size + linkedOutcomes.size} linked
                  </span>
                )}
              </div>
              <Icon name="expand_more" size="sm" className={`text-gray-400 transition-transform ${showEvidence ? 'rotate-180' : ''}`} />
            </button>

            {showEvidence && (
              <div className="p-4 space-y-4">
                {/* ILP Targets */}
                {ilpTargetsDue.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">ILP Targets</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {ilpTargetsDue.map(t => {
                        const isLinked = linkedIlpTargets.has(t.id)
                        const daysLeft = Math.ceil((new Date(t.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        const isUrgent = daysLeft <= 14
                        return (
                          <div key={t.id} className="flex items-start gap-3">
                            <button
                              onClick={() => handleLinkIlpTarget(t.id)}
                              disabled={linkingIlpTarget === t.id || isLinked}
                              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isLinked
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50'
                              }`}
                            >
                              <Icon name="link" size="sm" />
                              {isLinked ? '✓ Linked' : linkingIlpTarget === t.id ? '…' : 'Link'}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {daysLeft}d left
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">{t.target}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* EHCP Outcomes */}
                {ehcpOutcomes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">EHCP Outcomes</p>
                    <input
                      type="text"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Add evidence note (optional)"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    />
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {ehcpOutcomes.map(outcome => {
                        const isLinked = linkedOutcomes.has(outcome.id)
                        return (
                          <div key={outcome.id} className="flex items-start gap-3">
                            <button
                              onClick={() => handleLinkEhcp(outcome.id)}
                              disabled={linkingOutcome === outcome.id || isLinked}
                              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isLinked
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50'
                              }`}
                            >
                              <Icon name="link" size="sm" />
                              {isLinked ? '✓ Linked' : linkingOutcome === outcome.id ? '…' : 'Link'}
                            </button>
                            <div className="min-w-0">
                              <span className="text-xs text-gray-500">Section {outcome.section} · </span>
                              <span className="text-xs text-gray-700">{outcome.outcomeText}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Learning profile sidebar */}
      <div className="space-y-4">
        <button
          onClick={() => setExpandProfile(v => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3"
        >
          <span className="flex items-center gap-2"><Icon name="psychology" size="sm" className="text-purple-600" /> Learning Profile</span>
          <Icon name="expand_more" size="sm" className={`transition-transform ${expandProfile ? 'rotate-180' : ''}`} />
        </button>

        {expandProfile && (
          <div className="space-y-3">
            {loadingProfile ? (
              <p className="text-sm text-gray-400">Loading profile…</p>
            ) : !profile ? (
              <p className="text-sm text-gray-400">No profile data yet.</p>
            ) : (
              <>
                {profile.profileSummary && (
                  <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-900 leading-relaxed">
                    {profile.profileSummary}
                  </div>
                )}

                {profile.strengthAreas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Strengths</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.strengthAreas.map(s => (
                        <span key={s} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.developmentAreas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Development areas</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.developmentAreas.map(d => (
                        <span key={d} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(profile.typePerformance).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Type performance</p>
                    <div className="space-y-1.5">
                      {Object.entries(profile.typePerformance)
                        .sort((a, b) => b[1].avgScore - a[1].avgScore)
                        .slice(0, 5)
                        .map(([type, data]) => (
                          <div key={type} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-24 truncate capitalize">{type.replace(/_/g, ' ')}</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${data.avgScore}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-12 text-right">{gradeLabel(percentToGcseGrade(Math.round(data.avgScore)))}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400">
                  Completion rate: <span className="font-medium text-gray-600">{Math.round(profile.avgCompletionRate * 100)}%</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
