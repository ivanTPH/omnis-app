'use client'
import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { gradeLabel } from '@/lib/grading'
import RevisionDashboard from './RevisionDashboard'

// ── Shared types (mirrors revision-program/StudentRevisionView) ───────────────

type RevTask = {
  id:              string
  programId:       string
  taskType:        string
  instructions:    string
  focusTopics:     string[]
  sendAdaptations: string[]
  ilpTargetIds:    string[]
  estimatedMins:   number
  status:          string
  selfConfidence:  number | null
  completedAt:     Date | string | null
  finalScore:      number | null
  teacherScore:    number | null
  feedback:        string | null
  program: {
    title:    string
    subject:  string
    mode:     string
    deadline: Date | string | null
  }
}

type Exam = {
  id:           string
  subject:      string
  examBoard:    string | null
  paperName:    string | null
  examDate:     Date
  durationMins: number | null
  sessions:     { id: string; status: string }[]
}

type Session = {
  id:             string
  subject:        string
  topic:          string
  scheduledAt:    Date
  durationMins:   number
  status:         string
  confidence:     number | null
  notes:          string | null
  oakLessonSlug:  string | null
  oakLessonTitle?: string | null
}

type Stats = {
  totalPlanned:     number
  totalCompleted:   number
  totalSkipped:     number
  averageConfidence: number | null
  subjectBreakdown: { subject: string; planned: number; completed: number; skipped: number }[]
  streakDays:       number
}

type ConfidenceEntry = {
  subject:       string
  avgConfidence: number
  sessionCount:  number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Task cards ────────────────────────────────────────────────────────────────

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
        <span className="flex items-center gap-1"><Icon name="schedule" size="sm" /> ~{task.estimatedMins} mins</span>
      </div>

      {isAssignment && task.program.deadline && (
        <p className={`text-xs font-semibold flex items-center gap-1 ${overdue ? 'text-rose-600' : dueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
          {overdue && <Icon name="error" size="sm" />}
          {overdue
            ? `Overdue by ${Math.abs(due!)} day${Math.abs(due!) !== 1 ? 's' : ''}`
            : due === 0 ? 'Due today'
            : `Due: ${new Date(task.program.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
      )}
      {!isAssignment && (
        <p className="text-xs text-blue-600">No deadline — work at your own pace</p>
      )}

      <Link
        href={`/student/revision/${task.id}`}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      >
        {inProgress ? 'Continue' : 'Start Revision'} <Icon name="chevron_right" size="sm" />
      </Link>
    </div>
  )
}

function CompletedCard({ task }: { task: RevTask }) {
  const score = task.finalScore ?? task.teacherScore
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Icon name="check_circle" size="md" className="text-green-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${subjectColour(task.program.subject)}`}>
              {task.program.subject}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{task.program.title}</p>
          {task.focusTopics.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{task.focusTopics.slice(0, 3).join(' · ')}</p>
          )}
        </div>
        {score != null && (
          <span className="text-lg font-bold text-green-600 shrink-0">{gradeLabel(score)}</span>
        )}
      </div>

      {task.selfConfidence != null && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">Your confidence:</p>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(n => (
              <Icon key={n} name="star" size="sm" className={n <= (task.selfConfidence ?? 0) ? 'text-amber-400' : 'text-gray-300'} />
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyTasks({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-gray-400">
      <Icon name="assignment" size="lg" className="mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'planner' | 'tasks' | 'completed'

export default function UnifiedRevisionView({
  studentId,
  initialExams,
  initialSessions,
  initialStats,
  initialConfidence,
  activeTasks,
  completedTasks,
}: {
  studentId:         string
  initialExams:      Exam[]
  initialSessions:   Session[]
  initialStats:      Stats
  initialConfidence: ConfidenceEntry[]
  activeTasks:       RevTask[]
  completedTasks:    RevTask[]
}) {
  const [tab, setTab] = useState<Tab>(activeTasks.length > 0 ? 'tasks' : 'planner')

  const studyGuides = activeTasks.filter(t => t.program.mode === 'study_guide')
  const assignments = activeTasks.filter(t => t.program.mode !== 'study_guide')
  const dueThisWeek = activeTasks.filter(t => {
    const d = t.program.deadline
    if (!d) return false
    const days = daysUntil(d)
    return days >= 0 && days <= 7
  }).length

  const tabs: { key: Tab; label: string; count: number; icon: string }[] = [
    { key: 'planner',   label: 'My Planner',  count: initialExams.length, icon: 'calendar_today' },
    { key: 'tasks',     label: 'My Tasks',    count: activeTasks.length,   icon: 'assignment' },
    { key: 'completed', label: 'Completed',   count: completedTasks.length, icon: 'check_circle' },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="auto_stories" size="md" className="text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Revision Planner</h1>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {initialExams.length} exam{initialExams.length !== 1 ? 's' : ''} tracked
              {activeTasks.length > 0 && ` · ${activeTasks.length} task${activeTasks.length !== 1 ? 's' : ''} set by teacher`}
              {dueThisWeek > 0 && ` · ${dueThisWeek} due this week`}
            </p>
          </div>
        </div>

        {/* Urgency banner */}
        {dueThisWeek > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Icon name="timer" size="sm" className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {dueThisWeek} task{dueThisWeek !== 1 ? 's' : ''} due this week — check your Tasks tab.
            </p>
            <button onClick={() => setTab('tasks')} className="ml-auto text-xs text-amber-700 underline font-semibold">
              View tasks
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon name={t.icon} size="sm" />
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${
                  tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Planner tab ── */}
        {tab === 'planner' && (
          <RevisionDashboard
            studentId={studentId}
            initialExams={initialExams}
            initialSessions={initialSessions}
            initialStats={initialStats}
            initialConfidence={initialConfidence}
          />
        )}

        {/* ── Tasks tab ── */}
        {tab === 'tasks' && (
          <>
            {activeTasks.length === 0 ? (
              <EmptyTasks label="No revision tasks assigned yet. Your teacher will add tasks here." />
            ) : (
              <div className="space-y-4">
                {/* Assignments section */}
                {assignments.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icon name="assignment" size="sm" />Assignments ({assignments.length})
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {assignments.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                  </div>
                )}

                {/* Study guides section */}
                {studyGuides.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icon name="menu_book" size="sm" />Study Guides ({studyGuides.length})
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {studyGuides.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Completed tab ── */}
        {tab === 'completed' && (
          <>
            {completedTasks.length === 0 ? (
              <EmptyTasks label="No completed tasks yet. Finished tasks will appear here." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {completedTasks.map(t => <CompletedCard key={t.id} task={t} />)}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
