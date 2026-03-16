'use client'
import { useState } from 'react'
import Link from 'next/link'
import { BookMarked, Clock, CheckCircle2, ChevronRight, Star, AlertCircle } from 'lucide-react'

type RevTask = {
  id:             string
  programId:      string
  taskType:       string
  instructions:   string
  focusTopics:    string[]
  sendAdaptations: string[]
  ilpTargetIds:   string[]
  estimatedMins:  number
  status:         string
  selfConfidence: number | null
  completedAt:    Date | string | null
  finalScore:     number | null
  teacherScore:   number | null
  feedback:       string | null
  program: {
    title:    string
    subject:  string
    mode:     string
    deadline: Date | string | null
  }
}

type Tab = 'active' | 'completed' | 'study_guides'

function daysUntil(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function subjectColour(subject: string) {
  const map: Record<string, string> = {
    English: 'bg-purple-100 text-purple-700',
    Maths:   'bg-blue-100 text-blue-700',
    Science: 'bg-green-100 text-green-700',
    History: 'bg-amber-100 text-amber-700',
  }
  return map[subject] ?? 'bg-gray-100 text-gray-700'
}

function TaskCard({ task }: { task: RevTask }) {
  const isAssignment = task.program.mode === 'formal_assignment'
  const due          = task.program.deadline ? daysUntil(task.program.deadline) : null
  const overdue      = due != null && due < 0
  const dueSoon      = due != null && due >= 0 && due <= 7
  const hasIlp       = task.ilpTargetIds.length > 0
  const hasSend      = task.sendAdaptations.length > 0
  const inProgress   = task.status === 'in_progress'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${subjectColour(task.program.subject)}`}>
              {task.program.subject}
            </span>
            {hasSend && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                Adapted for you
              </span>
            )}
            {hasIlp && (
              <span className="text-[10px] text-purple-600 font-medium">Linked to your learning plan</span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900">{task.program.title}</p>
          {task.focusTopics.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Focus: {task.focusTopics.slice(0, 3).join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="capitalize">{task.taskType.replace(/_/g, ' ')}</span>
        <span className="flex items-center gap-1"><Clock size={10} /> ~{task.estimatedMins} mins</span>
      </div>

      {isAssignment && task.program.deadline && (
        <p className={`text-xs font-semibold flex items-center gap-1 ${overdue ? 'text-rose-600' : dueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
          {overdue && <AlertCircle size={11} />}
          {overdue ? `Overdue by ${Math.abs(due!)} day${Math.abs(due!) !== 1 ? 's' : ''}` :
           due === 0 ? 'Due today' :
           `Due: ${new Date(task.program.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
      )}
      {!isAssignment && (
        <p className="text-xs text-blue-600">No deadline — work at your own pace</p>
      )}

      <Link
        href={`/student/revision/${task.id}`}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      >
        {inProgress ? 'Continue' : 'Start Revision'} <ChevronRight size={15} />
      </Link>
    </div>
  )
}

function CompletedCard({ task }: { task: RevTask }) {
  const score = task.finalScore ?? task.teacherScore

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${subjectColour(task.program.subject)}`}>{task.program.subject}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{task.program.title}</p>
        </div>
        {score != null && (
          <span className="text-lg font-bold text-green-600 shrink-0">{score}/9</span>
        )}
      </div>

      {task.selfConfidence != null && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">Your confidence:</p>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(n => (
              <Star key={n} size={12} className={n <= (task.selfConfidence ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
            ))}
          </div>
        </div>
      )}

      {task.feedback && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Teacher Feedback</p>
          <p className="text-xs text-blue-800 leading-relaxed">{task.feedback}</p>
        </div>
      )}
    </div>
  )
}

export default function StudentRevisionView({
  active,
  completed,
}: {
  active:    RevTask[]
  completed: RevTask[]
}) {
  const [tab, setTab] = useState<Tab>('active')

  const studyGuides  = active.filter(t => t.program.mode === 'study_guide')
  const activeCount  = active.length
  const dueThisWeek  = active.filter(t => {
    const d = t.program.deadline
    if (!d) return false
    const days = daysUntil(d)
    return days >= 0 && days <= 7
  }).length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active',       label: 'Active',       count: active.length },
    { key: 'completed',    label: 'Completed',    count: completed.length },
    { key: 'study_guides', label: 'Study Guides', count: studyGuides.length },
  ]

  const shown = tab === 'active'       ? active
              : tab === 'completed'    ? completed
              : studyGuides

  return (
    <div className="flex-1 overflow-auto px-4 py-6 max-w-2xl mx-auto w-full">
      {/* header */}
      <div className="flex items-center gap-2 mb-2">
        <BookMarked size={20} className="text-gray-500" />
        <h1 className="text-lg font-semibold text-gray-900">My Revision</h1>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        {activeCount} active{dueThisWeek > 0 ? ` · ${dueThisWeek} due this week` : ''} · {completed.length} completed
      </p>

      {/* tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {t.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* content */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <BookMarked size={36} className="mb-3 opacity-30" />
          <p className="text-sm">{tab === 'completed' ? 'No completed tasks yet' : 'No revision tasks assigned yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tab === 'completed'
            ? shown.map(t => <CompletedCard key={t.id} task={t as RevTask} />)
            : shown.map(t => <TaskCard key={t.id} task={t as RevTask} />)
          }
        </div>
      )}
    </div>
  )
}
