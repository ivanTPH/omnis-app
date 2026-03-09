'use client'

import { useState, useTransition } from 'react'
import { Wand2, BookOpen, CheckCircle2, SkipForward, Flame } from 'lucide-react'
import ExamList             from './ExamList'
import WeeklyRevisionGrid   from './WeeklyRevisionGrid'
import PlanGeneratorModal   from './PlanGeneratorModal'
import ConfidenceChart      from './ConfidenceChart'
import { getMyRevisionSessions, getRevisionStats, getConfidenceProfile } from '@/app/actions/revision'

type Exam = {
  id:          string
  subject:     string
  examBoard:   string | null
  paperName:   string | null
  examDate:    Date
  durationMins: number | null
  sessions:    { id: string; status: string }[]
}

type Session = {
  id:            string
  subject:       string
  topic:         string
  scheduledAt:   Date
  durationMins:  number
  status:        string
  confidence:    number | null
  notes:         string | null
  oakLessonSlug: string | null
  oakLessonTitle?: string | null
}

type Stats = {
  totalPlanned:    number
  totalCompleted:  number
  totalSkipped:    number
  averageConfidence: number | null
  subjectBreakdown: { subject: string; planned: number; completed: number; skipped: number }[]
  streakDays:      number
}

type ConfidenceEntry = {
  subject:       string
  avgConfidence: number
  sessionCount:  number
}

function StatCard({ icon: Icon, label, value, colour }: {
  icon:   React.ElementType
  label:  string
  value:  string | number
  colour: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colour}`}>
        <Icon size={15} />
      </div>
      <div>
        <div className="text-[18px] font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  )
}

export default function RevisionDashboard({
  studentId,
  initialExams,
  initialSessions,
  initialStats,
  initialConfidence,
}: {
  studentId:         string
  initialExams:      Exam[]
  initialSessions:   Session[]
  initialStats:      Stats
  initialConfidence: ConfidenceEntry[]
}) {
  const [exams,      setExams]      = useState<Exam[]>(initialExams)
  const [sessions,   setSessions]   = useState<Session[]>(initialSessions)
  const [stats,      setStats]      = useState<Stats>(initialStats)
  const [confidence, setConfidence] = useState<ConfidenceEntry[]>(initialConfidence)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [, start] = useTransition()

  function refreshSessions(weekStart?: Date) {
    start(async () => {
      const updated = await getMyRevisionSessions(studentId, weekStart)
      setSessions(updated as Session[])
    })
  }

  function refreshAll() {
    start(async () => {
      const [updatedSessions, updatedStats, updatedConf] = await Promise.all([
        getMyRevisionSessions(studentId),
        getRevisionStats(studentId),
        getConfidenceProfile(studentId),
      ])
      setSessions(updatedSessions as Session[])
      setStats(updatedStats)
      setConfidence(updatedConf)
    })
  }

  // Exams refresh is triggered from ExamList via onRefresh — we reload the page
  // to pick up updated exam list (server component initial data)
  function handleExamRefresh() {
    window.location.reload()
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <StatCard icon={BookOpen}    label="Planned"   value={stats.totalPlanned}   colour="bg-blue-100 text-blue-700" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.totalCompleted} colour="bg-green-100 text-green-700" />
        <StatCard icon={SkipForward} label="Skipped"   value={stats.totalSkipped}   colour="bg-gray-100 text-gray-500" />
        <StatCard icon={Flame}       label="Day streak" value={`${stats.streakDays}🔥`} colour="bg-orange-100 text-orange-600" />
      </div>

      {/* Generate Plan button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowPlanModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Wand2 size={14} />
          Generate Plan
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left — Exam list + confidence chart */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <ExamList exams={exams} studentId={studentId} onRefresh={handleExamRefresh} />
          </div>
          {confidence.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <ConfidenceChart data={confidence} />
            </div>
          )}
        </div>

        {/* Right — Weekly grid */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <WeeklyRevisionGrid
            sessions={sessions}
            onWeekChange={monday => refreshSessions(monday)}
            onRefresh={refreshAll}
            studentId={studentId}
          />
        </div>
      </div>

      {showPlanModal && (
        <PlanGeneratorModal
          exams={exams}
          studentId={studentId}
          onClose={() => setShowPlanModal(false)}
          onRefresh={() => { setShowPlanModal(false); refreshAll() }}
        />
      )}
    </div>
  )
}
