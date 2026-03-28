'use client'

import { useState, useEffect, useTransition } from 'react'
import { getClassRagData, upsertTeacherPrediction } from '@/app/actions/rag'
import type { RagStudent, SavePredictionInput } from '@/app/actions/rag'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'

// ── RAG dot ───────────────────────────────────────────────────────────────────

const RAG_LABEL: Record<string, string> = {
  green:   'On track',
  amber:   'Slightly below',
  red:     'Significantly below',
  no_data: 'No data',
}

function RagDot({ status }: { status: RagStudent['ragStatus'] }) {
  const cls = {
    green:   'bg-green-500',
    amber:   'bg-amber-400',
    red:     'bg-red-500',
    no_data: 'bg-gray-300',
  }[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cls}`} />
      <span className="text-[11px] text-gray-500 hidden sm:inline">{RAG_LABEL[status]}</span>
    </span>
  )
}

// ── Expanded prediction form ──────────────────────────────────────────────────

function PredictionForm({
  student,
  subject,
  termLabel,
  onSaved,
}: {
  student:   RagStudent
  subject:   string
  termLabel: string
  onSaved:   (studentId: string) => void
}) {
  const existing = student.prediction
  const [score,  setScore]  = useState(existing?.predictedScore ?? student.baselineScore ?? 60)
  const [adj,    setAdj]    = useState(existing?.adjustment     ?? 0)
  const [notes,  setNotes]  = useState(existing?.notes          ?? '')
  const [saving, startSave] = useTransition()
  const [saved,  setSaved]  = useState(false)

  function handleSave() {
    const input: SavePredictionInput = {
      studentId:      student.id,
      subject,
      termLabel,
      predictedScore: Number(score),
      adjustment:     Number(adj),
      notes,
    }
    startSave(async () => {
      await upsertTeacherPrediction(input)
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved(student.id) }, 800)
    })
  }

  const effective = Number(score) + Number(adj)

  return (
    <div className="bg-gray-50 border-t border-gray-100 px-5 py-4 space-y-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Teacher Prediction — {termLabel}
      </p>

      <div className="flex flex-wrap items-end gap-4">
        {/* Baseline (read-only) */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Baseline</label>
          <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 min-w-[60px] text-center">
            {student.baselineScore != null ? `${student.baselineScore}` : '—'}
            {student.baselineSource && <span className="text-[10px] text-gray-400 ml-1">({student.baselineSource})</span>}
          </div>
        </div>

        {/* Predicted score */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Predicted score <span className="text-gray-400">(0–100)</span></label>
          <input
            type="number" min={0} max={100} step={1}
            value={score}
            onChange={e => setScore(Number(e.target.value))}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Adjustment */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Adjustment <span className="text-gray-400">(+/−)</span></label>
          <input
            type="number" min={-20} max={20} step={1}
            value={adj}
            onChange={e => setAdj(Number(e.target.value))}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Effective */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Effective</label>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700 min-w-[60px] text-center">
            {effective}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-gray-500">Notes <span className="text-gray-400">(optional)</span></label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Context, observations, supporting evidence…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {existing?.updatedAt && (
          <p className="text-[10px] text-gray-400">
            Last updated {new Date(existing.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
      >
        {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="save" size="sm" />}
        {saved ? 'Saved' : saving ? 'Saving…' : 'Save prediction'}
      </button>
    </div>
  )
}

// ── Student RAG row ───────────────────────────────────────────────────────────

function RagRow({
  student,
  subject,
  termLabel,
  expanded,
  onExpand,
  onSaved,
}: {
  student:   RagStudent
  subject:   string
  termLabel: string
  expanded:  boolean
  onExpand:  () => void
  onSaved:   (studentId: string) => void
}) {
  const effectivePredicted =
    student.prediction?.effectiveScore ?? student.baselineScore ?? null

  const sendLabel: Record<string, string> = { SEN_SUPPORT: 'SEN', EHCP: 'EHCP' }

  function scoreCell(val: number | null) {
    if (val == null) return <span className="text-gray-300">—</span>
    return <span className="font-semibold text-gray-800">{val}</span>
  }

  function effectiveCell() {
    if (effectivePredicted == null) return <span className="text-gray-300">—</span>
    return (
      <span className="font-semibold text-gray-800">
        {effectivePredicted}
        {student.prediction?.adjustment !== 0 && student.prediction != null && (
          <span className={`text-[11px] ml-1 ${student.prediction.adjustment > 0 ? 'text-green-600' : 'text-rose-500'}`}>
            {student.prediction.adjustment > 0 ? `+${student.prediction.adjustment}` : student.prediction.adjustment}
          </span>
        )}
      </span>
    )
  }

  return (
    <>
      <div
        onClick={onExpand}
        className="grid grid-cols-[1fr_auto_80px_80px_80px_80px] items-center gap-2 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors select-none"
      >
        {/* Name */}
        <div className="flex items-center gap-2 min-w-0">
          {expanded
            ? <Icon name="expand_more" size="sm" className="text-gray-400 shrink-0" />
            : <Icon name="chevron_right" size="sm" className="text-gray-400 shrink-0" />}
          <StudentAvatar
            firstName={student.firstName}
            lastName={student.lastName}
            avatarUrl={student.avatarUrl}
            sendStatus={student.sendCategory as any}
            size="xs"
          />
          <span className="text-sm font-medium text-gray-900 truncate">
            {student.lastName}, {student.firstName}
          </span>
          {student.hasSend && (
            <span className="hidden sm:inline text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
              {sendLabel[student.sendCategory ?? ''] ?? student.sendCategory}
            </span>
          )}
        </div>

        {/* RAG */}
        <RagDot status={student.ragStatus} />

        {/* Baseline */}
        <div className="text-right text-sm">{scoreCell(student.baselineScore)}</div>

        {/* Predicted (effective) */}
        <div className="text-right text-sm">{effectiveCell()}</div>

        {/* Working at */}
        <div className="text-right text-sm">{scoreCell(student.workingAtScore)}</div>

        {/* Last score */}
        <div className="text-right text-sm">{scoreCell(student.lastScore)}</div>
      </div>

      {expanded && (
        <PredictionForm
          student={student}
          subject={subject}
          termLabel={termLabel}
          onSaved={onSaved}
        />
      )}
    </>
  )
}

// ── Main RagView component ─────────────────────────────────────────────────────

type Props = {
  classId:   string
  subject:   string
  termLabel: string
}

export default function RagView({ classId, subject, termLabel }: Props) {
  const [students, setStudents] = useState<RagStudent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    const data = await getClassRagData(classId, termLabel)
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => { reload() }, [classId, termLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(studentId: string) {
    // Refresh data after prediction saved, keep the row expanded
    reload().then(() => setExpanded(studentId))
  }

  // ── Summary counts ─────────────────────────────────────────────────────────
  const green   = students.filter(s => s.ragStatus === 'green').length
  const amber   = students.filter(s => s.ragStatus === 'amber').length
  const red     = students.filter(s => s.ragStatus === 'red').length
  const noData  = students.filter(s => s.ragStatus === 'no_data').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-sm text-gray-400">
        No students enrolled in this class.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1">RAG summary</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {green} on track
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {amber} slightly below
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {red} significantly below
        </span>
        {noData > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-500 text-xs font-semibold rounded-full border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> {noData} no data
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">{termLabel}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_80px_80px_80px_80px] items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span>Student</span>
          <span>Status</span>
          <span className="text-right">Baseline</span>
          <span className="text-right">Predicted</span>
          <span className="text-right">Working at</span>
          <span className="text-right">Last score</span>
        </div>

        {/* Rows */}
        {students.map(s => (
          <RagRow
            key={s.id}
            student={s}
            subject={subject}
            termLabel={termLabel}
            expanded={expanded === s.id}
            onExpand={() => setExpanded(expanded === s.id ? null : s.id)}
            onSaved={handleSaved}
          />
        ))}
      </div>

      <p className="text-[11px] text-gray-400">
        Green = within 5 pts of predicted · Amber = 6–15 pts below · Red = &gt;15 pts below.
        Click a row to enter or update a teacher prediction.
      </p>
    </div>
  )
}
