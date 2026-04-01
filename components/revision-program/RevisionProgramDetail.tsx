'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { markRevisionTask } from '@/app/actions/revision-program'
import StudentAvatar from '@/components/StudentAvatar'

type RevTask = {
  id:             string
  studentId:      string
  taskType:       string
  instructions:   string
  modelAnswer?:   string | null
  focusTopics:    string[]
  weakTopics:     string[]
  strongTopics:   string[]
  sendAdaptations: string[]
  estimatedMins:  number
  status:         string
  submittedAt?:   Date | string | null
  studentResponse?: any
  teacherScore?:  number | null
  finalScore?:    number | null
  feedback?:      string | null
  markedAt?:      Date | string | null
  selfConfidence?: number | null
  completedAt?:   Date | string | null
  timeSpentMins?: number | null
}

type ProgramRow = {
  id:       string
  title:    string
  subject:  string
  mode:     string
  status:   string
  deadline: Date | string | null
}

type StudentMap = Record<string, { firstName: string; lastName: string; avatarUrl?: string | null }>

type FilterKey = 'all' | 'to_mark' | 'done' | 'not_started' | 'send'

function statusLabel(s: string) {
  const map: Record<string, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    submitted:   'Submitted',
    marked:      'Marked',
    returned:    'Returned',
  }
  return map[s] ?? s
}

export default function RevisionProgramDetail({
  program,
  tasks,
  completionStats,
  studentMap,
}: {
  program:        ProgramRow
  tasks:          RevTask[]
  completionStats: { total: number; notStarted: number; inProgress: number; submitted: number; marked: number }
  studentMap:     StudentMap
}) {
  const router = useRouter()
  const [filter, setFilter]       = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null)
  const [formScore, setFormScore]   = useState('')
  const [formFeedback, setFormFeedback] = useState('')
  const [isPending, startTransition]   = useTransition()
  const [savedId, setSavedId]          = useState<string | null>(null)
  const [error, setError]              = useState<string | null>(null)

  const isAssignment = program.mode === 'formal_assignment'

  // filter tasks
  const filtered = tasks.filter(t => {
    if (filter === 'to_mark')     return t.status === 'submitted'
    if (filter === 'done')        return ['marked', 'returned'].includes(t.status)
    if (filter === 'not_started') return t.status === 'not_started'
    if (filter === 'send')        return (studentMap[t.studentId] as any)?.sendStatus && (studentMap[t.studentId] as any)?.sendStatus !== 'NONE'
    return true
  })

  const selected = tasks.find(t => t.id === selectedId) ?? null
  const selectedStudent = selected ? studentMap[selected.studentId] : null

  // Pre-fill form when selection changes
  function selectTask(t: RevTask) {
    setSelectedId(t.id)
    setFormScore(t.finalScore != null ? String(t.finalScore) : t.teacherScore != null ? String(t.teacherScore) : '')
    setFormFeedback(t.feedback ?? '')
    setError(null)
    setSavedId(null)
  }

  function handleMark() {
    if (!selected) return
    const score = Number(formScore)
    if (isNaN(score) || score < 0 || score > 9) { setError('Score must be 0–9'); return }
    setError(null)
    startTransition(async () => {
      try {
        await markRevisionTask(selected.id, score, formFeedback)
        setSavedId(selected.id)
        router.refresh()
        setTimeout(() => setSavedId(null), 2500)
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  const tiles: { key: FilterKey; count: number; label: string; activeColor: string; inactiveColor: string }[] = [
    { key: 'all',         count: completionStats.total,      label: 'All',         activeColor: '#1f2937', inactiveColor: '#f9fafb' },
    { key: 'to_mark',     count: completionStats.submitted,  label: 'To Mark',     activeColor: '#2563eb', inactiveColor: '#eff6ff' },
    { key: 'done',        count: completionStats.marked,     label: 'Done',        activeColor: '#16a34a', inactiveColor: '#f0fdf4' },
    { key: 'not_started', count: completionStats.notStarted, label: 'Not Started', activeColor: '#dc2626', inactiveColor: '#fef2f2' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/revision-program" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <Icon name="chevron_left" size="md" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate text-sm">{program.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-blue-700 font-medium">{program.subject}</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isAssignment ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {isAssignment ? 'Assignment' : 'Study Guide'}
              </span>
            </div>
          </div>
        </div>
        {/* counter tiles */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {tiles.map(tile => (
            <button
              key={tile.key}
              onClick={() => setFilter(prev => prev === tile.key ? 'all' : tile.key)}
              style={{
                backgroundColor: filter === tile.key ? tile.activeColor : tile.inactiveColor,
                color:           filter === tile.key ? '#ffffff' : '#374151',
                border: '1px solid #e5e7eb',
              }}
              className="flex flex-col items-center w-16 py-2 rounded-xl"
            >
              <span className="text-2xl font-bold leading-none">{tile.count}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* two-panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* left: student list */}
        <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col">
          <div className="flex-1 overflow-auto py-2 px-2 space-y-0.5">
            {filtered.map(t => {
              const s = studentMap[t.studentId]
              if (!s) return null
              const active  = selectedId === t.id
              const isDone  = ['marked', 'returned'].includes(t.status)
              const isPending2 = t.status === 'submitted'
              return (
                <button
                  key={t.id}
                  onClick={() => selectTask(t)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <StudentAvatar firstName={s.firstName} lastName={s.lastName} avatarUrl={s.avatarUrl ?? null} size="xs" userId={t.studentId} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-medium truncate ${active ? 'text-blue-700' : 'text-gray-800'}`}>{s.firstName} {s.lastName}</p>
                    <p className="text-[10px] text-gray-400">{statusLabel(t.status)}</p>
                  </div>
                  {isDone && <Icon name="check_circle" size="sm" className="text-green-500 shrink-0" />}
                  {isPending2 && !isDone && <Icon name="schedule" size="sm" className="text-amber-400 shrink-0" />}
                  {t.status === 'not_started' && <Icon name="error" size="sm" className="text-gray-300 shrink-0" />}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-[11px] text-gray-400 px-3 py-4 text-center">No students in this filter</p>
            )}
          </div>
        </div>

        {/* right: task detail */}
        <div className="flex-1 overflow-auto">
          {!selected || !selectedStudent ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p className="text-[13px]">Select a student to view their task</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-5">
              {/* student header */}
              <div className="flex items-center gap-3">
                <StudentAvatar firstName={selectedStudent.firstName} lastName={selectedStudent.lastName} avatarUrl={selectedStudent.avatarUrl ?? null} size="md" userId={selected.studentId} />
                <div>
                  <p className="text-base font-semibold text-gray-900">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{statusLabel(selected.status)}</p>
                </div>
              </div>

              {/* focus topics */}
              {selected.focusTopics.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Focus Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.focusTopics.map(t => (
                      <span key={t} className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* instructions */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Task Instructions</p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {selected.instructions}
                </div>
              </div>

              {/* SEND adaptations */}
              {selected.sendAdaptations.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-purple-700">SEND Adaptations Applied</p>
                  <p className="text-xs text-purple-600 mt-0.5">{selected.sendAdaptations.join(', ')}</p>
                </div>
              )}

              {/* submission (if any) */}
              {selected.studentResponse && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Student Response</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-[13px] text-gray-800 leading-relaxed">
                    {typeof selected.studentResponse === 'string'
                      ? selected.studentResponse
                      : JSON.stringify(selected.studentResponse, null, 2)}
                  </div>
                  {selected.timeSpentMins && (
                    <p className="text-xs text-gray-400 mt-1.5">Time spent: {selected.timeSpentMins} minutes</p>
                  )}
                </div>
              )}

              {/* self-assessment (study guide) */}
              {!isAssignment && selected.selfConfidence != null && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">Self-confidence:</p>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Icon key={n} name="star" size="sm" className={n <= (selected.selfConfidence ?? 0) ? 'text-amber-400' : 'text-gray-300'} />
                    ))}
                  </div>
                </div>
              )}

              {/* marking form (assignment + submitted) */}
              {isAssignment && ['submitted', 'marked', 'returned'].includes(selected.status) && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="text-[12px] font-semibold text-gray-700">Mark Submission</p>
                  </div>
                  <div className="px-4 py-4 space-y-4">
                    <div className="flex items-start gap-4">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Score (out of 9)</label>
                        <input type="number" min={0} max={9} value={formScore} onChange={e => setFormScore(e.target.value)} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="—" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Feedback to Student</label>
                      <textarea rows={4} value={formFeedback} onChange={e => setFormFeedback(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Write constructive feedback…" />
                    </div>
                    {error && <p className="text-xs text-rose-600">{error}</p>}
                    <div className="flex items-center justify-between pt-1">
                      {savedId === selected.id ? (
                        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium"><Icon name="check_circle" size="sm" /> Saved & returned</span>
                      ) : <span />}
                      <button onClick={handleMark} disabled={isPending || formScore === ''} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors">
                        {isPending && <Icon name="refresh" size="sm" className="animate-spin" />}
                        Mark & Return
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
