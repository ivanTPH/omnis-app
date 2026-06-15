'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import {
  reviewIntegritySignal,
  closePatternCase,
  escalatePatternCase,
  updatePatternCaseStatus,
} from '@/app/actions/integrity'

export type SignalRow = {
  id:            string
  riskLevel:     string
  pasteRatio:    number
  focusLostCount: number
  pastedChars:   number
  typedChars:    number
  createdAt:     string
  studentName:   string
  studentId:     string
  homeworkTitle: string
  className:     string
  reviewLogs: {
    action:       string
    reviewerName: string
    createdAt:    string
    notes?:       string | null
  }[]
}

export type PatternCaseRow = {
  id:               string
  studentId:        string
  studentName:      string
  status:           string
  triggerCount:     number
  subjectCount:     number
  openedAt:         string
  closedAt?:        string | null
  notes?:           string | null
  escalatedAt?:     string | null
  escalatedByName?: string | null
  escalatedNotes?:  string | null
  outcomeCategory?: string | null
  closedByName?:    string | null
}

const RISK_CHIP: Record<string, string> = {
  HIGH:   'bg-rose-100 text-rose-700 border-rose-200',
  MEDIUM: 'bg-orange-100 text-orange-700 border-orange-200',
  LOW:    'bg-amber-100 text-amber-700 border-amber-200',
}

const CASE_STATUS_STYLE: Record<string, string> = {
  OPEN:              'bg-rose-100 text-rose-700',
  UNDER_REVIEW:      'bg-amber-100 text-amber-700',
  ESCALATED:         'bg-purple-100 text-purple-700',
  CLOSED_NO_ACTION:  'bg-gray-100 text-gray-500',
  CLOSED_ACTIONED:   'bg-green-100 text-green-700',
}

const CASE_STATUS_LABEL: Record<string, string> = {
  OPEN:              'Open',
  UNDER_REVIEW:      'Under Review',
  ESCALATED:         'Escalated to SLT',
  CLOSED_NO_ACTION:  'Closed — No Action',
  CLOSED_ACTIONED:   'Closed — Actioned',
}

const OUTCOME_CATEGORIES = [
  'Verbal warning',
  'Written warning',
  'Parent contacted',
  'Detention',
  'Referred to SLT',
  'Academic penalty',
  'No further action',
  'Other',
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Signal row with inline review actions ─────────────────────────────────────

function SignalTableRow({ signal, onDone }: { signal: SignalRow; onDone: () => void }) {
  const [open, setOpen]         = useState(false)
  const [notes, setNotes]       = useState('')
  const [isPending, startTrans] = useTransition()

  const lastReview = signal.reviewLogs[0]

  function act(action: 'RELEASED' | 'BLOCKED' | 'FLAGGED_FOR_RESUBMISSION') {
    startTrans(async () => {
      await reviewIntegritySignal(signal.id, action, notes || undefined)
      setOpen(false)
      setNotes('')
      onDone()
    })
  }

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
          {signal.studentName}
        </td>
        <td className="px-4 py-2.5 text-gray-600 max-w-[200px]">
          <span className="truncate block">{signal.homeworkTitle}</span>
          <span className="text-gray-400 text-[10px]">{signal.className}</span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${RISK_CHIP[signal.riskLevel] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {signal.riskLevel}
          </span>
        </td>
        <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell text-[12px]">
          {Math.round(signal.pasteRatio * 100)}%
        </td>
        <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell text-[12px]">
          {signal.focusLostCount}×
        </td>
        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-[12px]">
          {relativeTime(signal.createdAt)}
        </td>
        <td className="px-4 py-2.5 text-[11px]">
          {lastReview ? (
            <span className="text-green-600 flex items-center gap-1">
              <Icon name="check_circle" size="sm" />
              {lastReview.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
            </span>
          ) : (
            <span className="text-gray-400 flex items-center gap-1">
              <Icon name="pending" size="sm" />
              Pending
            </span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-blue-50">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add a note for this decision…"
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  disabled={isPending}
                  onClick={e => { e.stopPropagation(); act('RELEASED') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-[11px] font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Icon name="check_circle" size="sm" />
                  Release
                </button>
                <button
                  disabled={isPending}
                  onClick={e => { e.stopPropagation(); act('FLAGGED_FOR_RESUBMISSION') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  <Icon name="replay" size="sm" />
                  Resubmission
                </button>
                <button
                  disabled={isPending}
                  onClick={e => { e.stopPropagation(); act('BLOCKED') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  <Icon name="block" size="sm" />
                  Block
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setOpen(false) }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {lastReview && (
                <p className="w-full text-[11px] text-gray-500 mt-1">
                  Last reviewed by <strong>{lastReview.reviewerName}</strong> · {relativeTime(lastReview.createdAt)}
                  {lastReview.notes && ` · "${lastReview.notes}"`}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Pattern case row ─────────────────────────────────────────────────────────

function PatternCaseTableRow({ c, role, onDone }: { c: PatternCaseRow; role: string; onDone: () => void }) {
  const [open, setOpen]                 = useState(false)
  const [notes, setNotes]               = useState(c.notes ?? '')
  const [escalateNotes, setEscalateNotes] = useState('')
  const [outcomeCategory, setOutcomeCategory] = useState(c.outcomeCategory ?? '')
  const [isPending, startTrans]         = useTransition()
  const isClosed    = c.status.startsWith('CLOSED')
  const isEscalated = c.status === 'ESCALATED'

  function close(outcome: 'CLOSED_NO_ACTION' | 'CLOSED_ACTIONED') {
    startTrans(async () => {
      await closePatternCase(c.id, outcome, notes || undefined, outcomeCategory || undefined)
      setOpen(false)
      onDone()
    })
  }

  function escalate() {
    startTrans(async () => {
      await escalatePatternCase(c.id, escalateNotes || undefined)
      setOpen(false)
      onDone()
    })
  }

  function reopen() {
    startTrans(async () => {
      await updatePatternCaseStatus(c.id, 'OPEN')
      onDone()
    })
  }

  function markUnderReview() {
    startTrans(async () => {
      await updatePatternCaseStatus(c.id, 'UNDER_REVIEW')
      onDone()
    })
  }

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
          {c.studentName}
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${CASE_STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {CASE_STATUS_LABEL[c.status] ?? c.status}
          </span>
        </td>
        <td className="px-4 py-2.5 text-gray-700 font-semibold text-[12px]">{c.triggerCount}</td>
        <td className="px-4 py-2.5 text-gray-600 text-[12px]">{c.subjectCount}</td>
        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-[12px]">{relativeTime(c.openedAt)}</td>
      </tr>
      {open && (
        <tr className="bg-amber-50">
          <td colSpan={5} className="px-4 py-3 space-y-3">

            {/* Escalation provenance */}
            {c.escalatedByName && (
              <div className="flex items-start gap-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                <Icon name="arrow_upward" size="sm" className="text-purple-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-purple-700">
                  Escalated to SLT by <strong>{c.escalatedByName}</strong>
                  {c.escalatedAt ? ` · ${relativeTime(c.escalatedAt)}` : ''}
                  {c.escalatedNotes ? ` · "${c.escalatedNotes}"` : ''}
                </p>
              </div>
            )}

            {/* Closure info */}
            {isClosed && c.closedByName && (
              <p className="text-[11px] text-gray-500">
                Closed by <strong>{c.closedByName}</strong>
                {c.closedAt ? ` · ${relativeTime(c.closedAt)}` : ''}
                {c.outcomeCategory ? ` · Outcome: ${c.outcomeCategory}` : ''}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              {/* Notes input */}
              {!isClosed && !isEscalated && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Case notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Case notes…"
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              )}

              {/* Outcome category for closing */}
              {!isClosed && !isEscalated && (
                <div className="min-w-[180px]">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Outcome category</label>
                  <select
                    value={outcomeCategory}
                    onChange={e => setOutcomeCategory(e.target.value)}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="">Select outcome…</option>
                    {OUTCOME_CATEGORIES.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* HOY escalation notes */}
              {!isClosed && !isEscalated && role === 'HEAD_OF_YEAR' && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Escalation notes (optional)</label>
                  <input
                    type="text"
                    value={escalateNotes}
                    onChange={e => setEscalateNotes(e.target.value)}
                    placeholder="Reason for escalating to SLT…"
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {!isClosed && !isEscalated && c.status !== 'UNDER_REVIEW' && (
                  <button
                    disabled={isPending}
                    onClick={e => { e.stopPropagation(); markUnderReview() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="visibility" size="sm" />
                    Mark Under Review
                  </button>
                )}
                {!isClosed && !isEscalated && role === 'HEAD_OF_YEAR' && (
                  <button
                    disabled={isPending}
                    onClick={e => { e.stopPropagation(); escalate() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="arrow_upward" size="sm" />
                    Escalate to SLT
                  </button>
                )}
                {!isClosed && !isEscalated && (
                  <>
                    <button
                      disabled={isPending}
                      onClick={e => { e.stopPropagation(); close('CLOSED_ACTIONED') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                    >
                      <Icon name="gavel" size="sm" />
                      Close — Actioned
                    </button>
                    <button
                      disabled={isPending}
                      onClick={e => { e.stopPropagation(); close('CLOSED_NO_ACTION') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-600 text-white text-[11px] font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      <Icon name="do_not_disturb" size="sm" />
                      Close — No Action
                    </button>
                  </>
                )}
                {(isClosed || isEscalated) && (
                  <button
                    disabled={isPending}
                    onClick={e => { e.stopPropagation(); reopen() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="undo" size="sm" />
                    Reopen
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setOpen(false) }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {c.notes && !isClosed && (
                <p className="w-full text-[11px] text-gray-500 mt-1">Existing notes: &quot;{c.notes}&quot;</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Filter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
type CaseFilter = 'OPEN' | 'ALL'

export default function IntegrityView({
  signals,
  patternCases,
  yearGroup,
  role,
}: {
  signals:      SignalRow[]
  patternCases: PatternCaseRow[]
  yearGroup:    number | null
  role:         string
}) {
  const [filter, setFilter]           = useState<Filter>('ALL')
  const [caseFilter, setCaseFilter]   = useState<CaseFilter>('OPEN')
  // dummy state to force re-render on action completion (server revalidates)
  const [tick, setTick]               = useState(0)

  const visibleSignals = filter === 'ALL'
    ? signals
    : signals.filter(s => s.riskLevel === filter)

  const isActive = (c: PatternCaseRow) => !c.status.startsWith('CLOSED')

  const visibleCases = caseFilter === 'OPEN'
    ? patternCases.filter(isActive)
    : patternCases

  const highCount   = signals.filter(s => s.riskLevel === 'HIGH').length
  const medCount    = signals.filter(s => s.riskLevel === 'MEDIUM').length
  const lowCount    = signals.filter(s => s.riskLevel === 'LOW').length
  const openCases   = patternCases.filter(isActive).length
  const reviewedCount = signals.filter(s => s.reviewLogs.length > 0).length

  function onDone() { setTick(t => t + 1) }

  const FILTER_CHIPS: { key: Filter; label: string; count: number; style: string }[] = [
    { key: 'ALL',    label: 'All',    count: signals.length, style: 'bg-gray-100 text-gray-700' },
    { key: 'HIGH',   label: 'High',   count: highCount,      style: 'bg-rose-100 text-rose-700' },
    { key: 'MEDIUM', label: 'Medium', count: medCount,       style: 'bg-orange-100 text-orange-700' },
    { key: 'LOW',    label: 'Low',    count: lowCount,       style: 'bg-amber-100 text-amber-700' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title">Academic Integrity</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {yearGroup ? `Year ${yearGroup} · ` : ''}Submission integrity signals collected automatically during homework
            </p>
          </div>
          <a
            href="/api/export/integrity-report"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <Icon name="download" size="sm" />
            Export PDF
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{signals.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Total flagged</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-rose-700">{highCount}</p>
          <p className="text-[11px] text-rose-500 mt-0.5">High risk</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-orange-700">{medCount}</p>
          <p className="text-[11px] text-orange-500 mt-0.5">Medium risk</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-700">{openCases}</p>
          <p className="text-[11px] text-amber-500 mt-0.5">Open cases</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{reviewedCount}</p>
          <p className="text-[11px] text-green-500 mt-0.5">Reviewed</p>
        </div>
      </div>

      {/* Flagged submissions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-gray-900">Flagged Submissions</h2>
          <div className="flex gap-1.5">
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  filter === chip.key ? chip.style + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {chip.label} {chip.count > 0 && <span className="ml-0.5">({chip.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {visibleSignals.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <Icon name="verified" size="lg" className="mx-auto mb-2 text-green-500" />
            <p className="text-[13px] text-green-700 font-medium">No flags at this risk level</p>
            <p className="text-[11px] text-green-600 mt-1">All recent submissions appear authentic</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Homework</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Risk</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">Paste %</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">Focus lost</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">When</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleSignals.map(s => (
                  <SignalTableRow key={s.id + tick} signal={s} onDone={onDone} />
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
              Click a row to expand review actions
            </p>
          </div>
        )}
      </div>

      {/* Pattern cases */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-gray-900">Pattern Cases</h2>
          <div className="flex gap-1.5">
            {(['OPEN', 'ALL'] as CaseFilter[]).map(key => (
              <button
                key={key}
                onClick={() => setCaseFilter(key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  caseFilter === key
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {key === 'OPEN' ? 'Open only' : 'All cases'}
              </button>
            ))}
          </div>
        </div>

        {visibleCases.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <Icon name="check_circle" size="lg" className="mx-auto mb-2 text-gray-400" />
            <p className="text-[13px] text-gray-500">No pattern cases</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Triggers</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Subjects</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleCases.map(c => (
                  <PatternCaseTableRow key={c.id + tick} c={c} role={role} onDone={onDone} />
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
              Click a row to manage the case
            </p>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="flex items-start gap-2 text-[11px] text-gray-400">
        <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
        <p>
          Integrity signals are collected automatically when students complete homework.
          High paste ratios or frequent focus-loss may indicate AI assistance or copying.
          Always investigate with the student and their form tutor before taking action.
          <strong className="text-gray-500"> Releasing</strong> a flag marks it as legitimate.
          <strong className="text-gray-500"> Blocking</strong> prevents the submission from being marked.
          <strong className="text-gray-500"> Resubmission</strong> requests a fresh attempt.
        </p>
      </div>

    </div>
  )
}
