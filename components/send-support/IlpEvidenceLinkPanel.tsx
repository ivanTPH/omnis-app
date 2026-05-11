'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { saveIlpEvidenceEntries } from '@/app/actions/homework'
import { formatRawScore } from '@/lib/gradeUtils'
import type { SubmissionForEvidencing } from '@/app/actions/homework'

type IlpTarget = { id: string; target: string; status: string }

type Props = {
  studentId:  string
  submissions: SubmissionForEvidencing[]
  ilpTargets:  IlpTarget[]
}

const TYPE_OPTS: { value: 'PROGRESS' | 'CONCERN' | 'NEUTRAL'; label: string; cls: string }[] = [
  { value: 'PROGRESS', label: 'Progress', cls: 'bg-green-100 text-green-700'  },
  { value: 'CONCERN',  label: 'Concern',  cls: 'bg-rose-100 text-rose-700'    },
  { value: 'NEUTRAL',  label: 'Neutral',  cls: 'bg-gray-100 text-gray-500'    },
]

const FORMAT_LABELS: Record<string, string> = {
  retrieval_practice: 'Retrieval',
  quiz:               'Quiz',
  multiple_choice:    'MCQ',
  short_answer:       'Short Answer',
  essay:              'Essay',
  mind_map:           'Mind Map',
  reading_response:   'Reading',
  research_task:      'Research',
  creative:           'Creative',
  practical:          'Practical',
  free_text:          'Free Text',
}

export default function IlpEvidenceLinkPanel({ submissions, ilpTargets }: Props) {
  const router = useRouter()
  const [localSubs,    setLocalSubs]    = useState(submissions)
  const [linking,      setLinking]      = useState<string | null>(null)   // submission id being linked
  const [targetId,     setTargetId]     = useState('')
  const [evidenceType, setEvidenceType] = useState<'PROGRESS' | 'CONCERN' | 'NEUTRAL'>('PROGRESS')
  const [note,         setNote]         = useState('')
  const [saving,       startSaving]     = useTransition()
  const [error,        setError]        = useState<string | null>(null)
  const [showLinked,   setShowLinked]   = useState(false)

  if (ilpTargets.length === 0) return null

  const unlinked = localSubs.filter(s => s.linkedTargetIds.length === 0)
  const linked   = localSubs.filter(s => s.linkedTargetIds.length > 0)

  function openLink(subId: string) {
    setLinking(subId)
    setTargetId(ilpTargets[0]?.id ?? '')
    setEvidenceType('PROGRESS')
    setNote('')
    setError(null)
  }

  function handleSave(sub: SubmissionForEvidencing) {
    if (!targetId) return
    setError(null)
    startSaving(async () => {
      try {
        await saveIlpEvidenceEntries(sub.id, [{
          ilpTargetId:  targetId,
          evidenceType,
          aiSummary:    '',
          teacherNote:  note || undefined,
        }])
        setLocalSubs(prev => prev.map(s =>
          s.id === sub.id
            ? { ...s, linkedTargetIds: [...s.linkedTargetIds, targetId] }
            : s
        ))
        setLinking(null)
        router.refresh()
      } catch {
        setError('Failed to save — please try again.')
      }
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Icon name="link" size="sm" className="text-indigo-500" />
        <h2 className="text-[14px] font-semibold text-gray-900">Link Homework Evidence to ILP</h2>
        <span className="ml-auto text-[11px] text-gray-400">
          {unlinked.length} unlinked · {linked.length} linked
        </span>
      </div>

      {unlinked.length === 0 && (
        <div className="px-5 py-6 text-center">
          <Icon name="check_circle" size="md" className="text-green-500 mx-auto mb-2" />
          <p className="text-[13px] text-gray-500">All returned submissions have been linked to ILP targets.</p>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {unlinked.map(sub => {
          const isLinking = linking === sub.id
          return (
            <div key={sub.id} className="px-5 py-3">
              {isLinking ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-gray-900">{sub.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {sub.subject} · {sub.className} · {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {sub.grade && <> · <span className="font-semibold text-blue-600">Gr {sub.grade}</span></>}
                      </p>
                    </div>
                    <button onClick={() => setLinking(null)} className="text-gray-300 hover:text-gray-500">
                      <Icon name="close" size="sm" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">ILP Target</label>
                    <select
                      value={targetId}
                      onChange={e => setTargetId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      {ilpTargets.map(t => (
                        <option key={t.id} value={t.id}>{t.target}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide shrink-0">Evidence type</label>
                    <div className="flex gap-1.5">
                      {TYPE_OPTS.map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setEvidenceType(o.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                            evidenceType === o.value ? `${o.cls} border-current` : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Note (optional)</label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="e.g. Student demonstrated clear understanding of paragraph structure…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>

                  {error && <p className="text-[11px] text-red-600">{error}</p>}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(sub)}
                      disabled={!targetId || saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-medium transition-colors"
                    >
                      {saving
                        ? <><Icon name="refresh" size="sm" className="animate-spin" /> Saving…</>
                        : <><Icon name="link" size="sm" /> Link evidence</>
                      }
                    </button>
                    <button onClick={() => setLinking(null)} className="text-[12px] text-gray-400 hover:text-gray-600">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{sub.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {sub.subject}
                      {sub.homeworkVariantType && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                          {FORMAT_LABELS[sub.homeworkVariantType] ?? sub.homeworkVariantType}
                        </span>
                      )}
                      {' · '}{new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {sub.grade && (
                    <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg shrink-0">
                      Gr {sub.grade}
                    </span>
                  )}
                  {sub.finalScore != null && !sub.grade && (
                    <span className="text-[11px] font-semibold text-gray-600 shrink-0">
                      {formatRawScore(sub.finalScore)}
                    </span>
                  )}
                  <button
                    onClick={() => openLink(sub.id)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg text-[11px] font-medium transition-colors"
                  >
                    <Icon name="link" size="sm" /> Link
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {linked.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowLinked(v => !v)}
            className="w-full flex items-center gap-2 px-5 py-3 text-[12px] text-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Icon name={showLinked ? 'expand_less' : 'expand_more'} size="sm" />
            {showLinked ? 'Hide' : 'Show'} {linked.length} already-linked submission{linked.length !== 1 ? 's' : ''}
          </button>
          {showLinked && (
            <div className="divide-y divide-gray-50">
              {linked.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 px-5 py-3 bg-gray-50">
                  <Icon name="check_circle" size="sm" className="text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-700 truncate">{sub.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {sub.subject} · linked to {sub.linkedTargetIds.length} target{sub.linkedTargetIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {sub.grade && (
                    <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg shrink-0">Gr {sub.grade}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
