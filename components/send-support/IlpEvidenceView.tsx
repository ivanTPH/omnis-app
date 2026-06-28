'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { SencoRow } from '@/components/ui/SencoRow'
import type { IlpEvidenceSummary, IlpEvidenceStudent, IlpEvidenceTarget } from '@/app/actions/adaptive-learning'
import { requestILPEvidence, addManualIlpEvidence } from '@/app/actions/ilp-evidence'

// ── Helpers ────────────────────────────────────────────────────────────────────

function gradeLabel(g: number | null) {
  if (g == null) return '—'
  const letters: Record<number, string> = { 9:'A**', 8:'A*', 7:'A', 6:'B', 5:'C+', 4:'C', 3:'D', 2:'E', 1:'F' }
  return `${g} (${letters[g] ?? '?'})`
}

function daysPill(days: number) {
  if (days < 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>
  if (days === 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Today</span>
  if (days <= 7)  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{days}d</span>
  if (days <= 14) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{days}d</span>
  if (days <= 30) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{days}d</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{days}d</span>
}

function EvidenceDot({ target }: { target: IlpEvidenceTarget }) {
  const achieved = target.status === 'achieved'
  const hasEvid  = target.evidenceCount > 0
  const overdue  = !hasEvid && !achieved && target.targetDate < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  if (achieved) return (
    <span title="Achieved" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
      <Icon name="check_circle" size="sm" /> Achieved
    </span>
  )
  if (hasEvid) return (
    <span title={`${target.evidenceCount} piece${target.evidenceCount > 1 ? 's' : ''} of evidence`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
      <Icon name="link" size="sm" /> {target.evidenceCount} evidence
    </span>
  )
  if (overdue) return (
    <span title="No evidence — target date approaching" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
      <Icon name="warning" size="sm" /> No evidence
    </span>
  )
  return (
    <span title="No evidence linked yet" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
      <Icon name="radio_button_unchecked" size="sm" /> Pending
    </span>
  )
}

// ── Student Row ────────────────────────────────────────────────────────────────

type EvidenceType = 'PROGRESS' | 'CONCERN' | 'NEUTRAL'

function StudentRow({ student, expanded, onToggle }: {
  student: IlpEvidenceStudent
  expanded: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const [requesting,  setRequesting]  = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  // Per-target inline evidence form state
  const [addingFor,      setAddingFor]      = useState<string | null>(null)
  const [evidenceType,   setEvidenceType]   = useState<EvidenceType>('PROGRESS')
  const [evidenceNote,   setEvidenceNote]   = useState('')
  const [savingEvidence, setSavingEvidence] = useState(false)
  const [savedTargets,   setSavedTargets]   = useState<Set<string>>(new Set())

  async function handleAddEvidence(targetId: string) {
    setSavingEvidence(true)
    try {
      const result = await addManualIlpEvidence(targetId, student.studentId, evidenceType, evidenceNote)
      if (result.success) {
        setSavedTargets(prev => new Set([...prev, targetId]))
        setAddingFor(null)
        setEvidenceNote('')
        setEvidenceType('PROGRESS')
        router.refresh()
      }
    } finally {
      setSavingEvidence(false)
    }
  }

  async function handleRequestEvidence() {
    setRequesting(true)
    try {
      await requestILPEvidence(student.studentId)
      setRequestSent(true)
    } finally {
      setRequesting(false)
    }
  }

  const isEvidenceGapBanner = student.hasEvidenceGap && student.daysUntilReview > 14
  const gapCount = student.totalTargets - student.targetsWithEvidence

  const recIcon =
    student.daysUntilReview <= 14 ? 'schedule'
    : student.hasEvidenceGap ? 'warning'
    : student.targetsOnTrack === student.totalTargets ? 'check_circle'
    : 'info'
  const recColor =
    student.daysUntilReview <= 14 ? 'text-red-600'
    : student.hasEvidenceGap ? 'text-amber-600'
    : student.targetsOnTrack === student.totalTargets ? 'text-green-600'
    : 'text-blue-600'

  const initials = student.studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const sendBadgeClass =
    student.sendStatus === 'EHCP' ? 'text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700' :
    student.sendStatus === 'SEN_SUPPORT' ? 'text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700' :
    'badge-open'

  return (
    <SencoRow
      studentName={student.studentName}
      studentInitials={initials}
      avatarColour="bg-purple-400"
      badges={[
        { label: student.sendStatus.replace(/_/g, ' '), variant: 'custom', customClass: sendBadgeClass },
      ]}
      meta={[
        { label: 'SEND STATUS',       value: student.sendCategory },
        { label: 'TARGETS EVIDENCED', value: `${student.targetsWithEvidence}/${student.totalTargets}` },
        { label: 'CURRENT GRADE',     value: student.workingAtGrade != null ? gradeLabel(student.workingAtGrade) : '—' },
        { label: 'REVIEW',            value: new Date(student.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) },
      ]}
      rightContent={daysPill(student.daysUntilReview)}
      isExpanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {/* Recommendation */}
        <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
          student.daysUntilReview <= 14 ? 'bg-red-50 border border-red-200' :
          student.hasEvidenceGap ? 'bg-amber-50 border border-amber-200' :
          student.targetsOnTrack === student.totalTargets ? 'bg-green-50 border border-green-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Icon name={recIcon} size="sm" className={`${recColor} shrink-0 mt-0.5`} />
            <div>
              <p className="text-[12px] font-medium text-gray-800">{student.reviewRecommendation}</p>
              {isEvidenceGapBanner && (
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {gapCount} target{gapCount !== 1 ? 's' : ''} with no linked homework evidence.
                </p>
              )}
            </div>
          </div>
          {isEvidenceGapBanner && (
            <button
              onClick={handleRequestEvidence}
              disabled={requesting || requestSent}
              className={`shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                requestSent
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <Icon
                name={requestSent ? 'check' : requesting ? 'refresh' : 'send'}
                size="sm"
                className={requesting ? 'animate-spin' : ''}
              />
              {requestSent ? 'Sent' : 'Notify teachers'}
            </button>
          )}
        </div>

        {/* Adaptive profile summary */}
        {student.profileSummary && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <Icon name="auto_fix_high" size="sm" className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[12px] text-emerald-800 leading-snug">{student.profileSummary}</p>
          </div>
        )}

        {/* ILP targets */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">ILP Targets</p>
          <div className="space-y-2">
            {student.targets.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] text-gray-800 leading-snug flex-1">{t.target}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {savedTargets.has(t.id) && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                        <Icon name="check" size="sm" /> Saved
                      </span>
                    )}
                    <EvidenceDot target={t} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-400">
                    Target date: {new Date(t.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {t.lastLinkedAt && (
                    <span className="text-[10px] text-gray-400">
                      Last evidence: {new Date(t.lastLinkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {t.progressNote && (
                    <span className="text-[10px] text-gray-500 italic truncate max-w-[200px]">{t.progressNote}</span>
                  )}
                </div>

                {/* Add evidence toggle */}
                {addingFor !== t.id ? (
                  <button
                    onClick={() => { setAddingFor(t.id); setEvidenceType('PROGRESS'); setEvidenceNote('') }}
                    className="mt-2 flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-800 font-medium"
                  >
                    <Icon name="add_circle_outline" size="sm" /> Add evidence
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                    {/* Evidence type selector */}
                    <div className="flex items-center gap-2">
                      {(['PROGRESS', 'CONCERN', 'NEUTRAL'] as EvidenceType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => setEvidenceType(type)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                            evidenceType === type
                              ? type === 'PROGRESS' ? 'bg-green-600 text-white border-green-600'
                                : type === 'CONCERN' ? 'bg-red-600 text-white border-red-600'
                                : 'bg-gray-500 text-white border-gray-500'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {type === 'PROGRESS' ? 'Progress' : type === 'CONCERN' ? 'Concern' : 'Neutral'}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={evidenceNote}
                      onChange={e => setEvidenceNote(e.target.value)}
                      placeholder="Add a note about this evidence (optional)…"
                      rows={2}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddEvidence(t.id)}
                        disabled={savingEvidence}
                        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {savingEvidence
                          ? <Icon name="refresh" size="sm" className="animate-spin" />
                          : <Icon name="save" size="sm" />
                        }
                        Save
                      </button>
                      <button
                        onClick={() => setAddingFor(null)}
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/student/${student.studentId}/send`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[12px] font-medium transition-colors"
          >
            <Icon name="open_in_new" size="sm" /> View SEND record
          </Link>
          <Link
            href="/senco/ilp"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-[12px] font-medium transition-colors"
          >
            <Icon name="edit_note" size="sm" /> Manage ILP
          </Link>
        </div>
      </div>
    </SencoRow>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'all' | 'review_soon' | 'evidence_gap' | 'on_track'

export default function IlpEvidenceView({ data }: { data: IlpEvidenceSummary }) {
  const [activeTab,    setActiveTab]    = useState<Tab>('all')
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set())
  const [search,       setSearch]       = useState('')

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const visibleStudents = useMemo(() => {
    let list = data.students
    if (activeTab === 'review_soon')   list = list.filter(s => s.reviewSoon)
    if (activeTab === 'evidence_gap')  list = list.filter(s => s.hasEvidenceGap)
    if (activeTab === 'on_track')      list = list.filter(s => !s.hasEvidenceGap && s.daysUntilReview > 14)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => s.studentName.toLowerCase().includes(q) || s.sendCategory.toLowerCase().includes(q))
    }
    return list
  }, [data.students, activeTab, search])

  const reviewSoonCount  = data.students.filter(s => s.reviewSoon).length
  const evidenceGapCount = data.students.filter(s => s.hasEvidenceGap).length
  const onTrackCount     = data.students.filter(s => !s.hasEvidenceGap && s.daysUntilReview > 14).length

  const tabs: { id: Tab; label: string; count: number; color: string; activeColor: string }[] = [
    {
      id: 'all',
      label: 'All Students',
      count: data.studentsWithIlp,
      color: 'text-gray-600 bg-white border-gray-200',
      activeColor: 'bg-purple-600 text-white border-purple-600',
    },
    {
      id: 'review_soon',
      label: 'Review Due (30d)',
      count: reviewSoonCount,
      color: reviewSoonCount > 0 ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-gray-400 bg-white border-gray-200',
      activeColor: 'bg-orange-500 text-white border-orange-500',
    },
    {
      id: 'evidence_gap',
      label: 'Evidence Gaps',
      count: evidenceGapCount,
      color: evidenceGapCount > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-400 bg-white border-gray-200',
      activeColor: 'bg-amber-500 text-white border-amber-500',
    },
    {
      id: 'on_track',
      label: 'On Track',
      count: onTrackCount,
      color: 'text-green-700 bg-green-50 border-green-200',
      activeColor: 'bg-green-600 text-white border-green-600',
    },
  ]

  return (
    <div className="space-y-5">

      {/* Summary stat tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              activeTab === tab.id ? tab.activeColor : tab.color + ' hover:opacity-80'
            }`}
          >
            <div className="text-3xl font-bold">{tab.count}</div>
            <div className="text-xs font-medium mt-1 leading-snug">{tab.label}</div>
            {activeTab === tab.id && (
              <div className="mt-1.5 text-[10px] opacity-80 flex items-center gap-1">
                <Icon name="filter_list" size="sm" /> Filtered
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Additional stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-[12px] text-green-700">
          <Icon name="check_circle" size="sm" />
          <span>{data.targetsOnTrack} targets with evidence</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-amber-700">
          <Icon name="radio_button_unchecked" size="sm" />
          <span>{data.targetsWithNoEvidence} targets without evidence</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-red-700">
          <Icon name="warning" size="sm" />
          <span>{data.targetsBehind} targets behind (due &lt;14d)</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students or SEND category…"
          className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {/* Student list */}
      {visibleStudents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="person_search" size="lg" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search ? 'No students match your search.' : activeTab === 'on_track' ? 'No students currently on track in this filter.' : 'No students in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-gray-500">
              Showing {visibleStudents.length} student{visibleStudents.length !== 1 ? 's' : ''}
            </p>
            {expandedIds.size > 0 && (
              <button
                onClick={() => setExpandedIds(new Set())}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <Icon name="expand_less" size="sm" /> Collapse all
              </button>
            )}
          </div>
          {visibleStudents.map(student => (
            <StudentRow
              key={student.studentId}
              student={student}
              expanded={expandedIds.has(student.studentId)}
              onToggle={() => toggleExpand(student.studentId)}
            />
          ))}
        </div>
      )}

      {/* How evidence is collected tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="bar_chart" size="sm" className="text-blue-600" />
          <p className="text-[12px] font-semibold text-blue-800">How to link evidence</p>
        </div>
        <ul className="text-[11px] text-blue-700 space-y-1">
          <li>• Click <strong>Add evidence</strong> on any ILP target to manually log a Progress, Concern or Neutral entry</li>
          <li>• When marking homework, click <strong>Record as ILP evidence</strong> in the SEND sidebar</li>
          <li>• When creating homework, use Step 5 to link to ILP targets</li>
          <li>• AI classifies each linked piece as Progress, Concern or Neutral</li>
          <li>• Evidence appears in the student&apos;s SEND record and feeds AI progress reports</li>
        </ul>
      </div>
    </div>
  )
}
