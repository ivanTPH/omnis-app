'use client'

import { useState, useEffect, useTransition } from 'react'
import { getClassRagData, upsertTeacherPrediction } from '@/app/actions/rag'
import type { RagStudent, RagStatus, SavePredictionInput } from '@/app/actions/rag'
import { getStudentFile, saveStudentNote } from '@/app/actions/students'
import type { StudentFileData } from '@/app/actions/students'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'
import { gradeLabel, percentToGcseGrade } from '@/lib/grading'
import { formatRawScore } from '@/lib/gradeUtils'

// ── RAG helpers ───────────────────────────────────────────────────────────────

const RAG_LABEL: Record<string, string> = {
  green:   'On Track',
  amber:   'Developing',
  red:     'Needs Support',
  no_data: 'No data',
}

function RagStatusDot({ status }: { status: RagStudent['ragStatus'] }) {
  const cls = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500', no_data: 'bg-gray-300' }[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cls}`} />
      <span className="text-[11px] text-gray-500 hidden sm:inline">{RAG_LABEL[status]}</span>
    </span>
  )
}

// ── Sparkline (inline SVG, no chart library) ──────────────────────────────────

function Sparkline({ grades }: { grades: number[] }) {
  if (grades.length < 2) return <span className="text-[11px] text-gray-400 italic">not enough data</span>
  const W = 80, H = 32
  const min = 1, max = 9
  const pts = grades.map((g, i) => {
    const x = (i / (grades.length - 1)) * W
    const y = H - Math.max(0, Math.min(H, ((g - min) / (max - min)) * H))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  // Compare most-recent (index 0, DESC order) vs previous (index 1)
  const trend = grades[0] - grades[1]
  const color = trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#94a3b8'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {grades.map((g, i) => {
        const x = (i / (grades.length - 1)) * W
        const y = H - Math.max(0, Math.min(H, ((g - min) / (max - min)) * H))
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} />
      })}
    </svg>
  )
}

// ── Prediction form (inline expand) ──────────────────────────────────────────

function PredictionForm({
  student, subject, termLabel, onSaved,
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
      studentId: student.id, subject, termLabel,
      predictedScore: Number(score), adjustment: Number(adj), notes,
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
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Baseline</label>
          <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 min-w-[60px] text-center">
            {student.baselineScore != null ? `${student.baselineScore}` : '—'}
            {student.baselineSource && <span className="text-[10px] text-gray-400 ml-1">({student.baselineSource})</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Predicted score <span className="text-gray-400">(0–100)</span></label>
          <input type="number" min={0} max={100} step={1} value={score} onChange={e => setScore(Number(e.target.value))}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Adjustment <span className="text-gray-400">(+/−)</span></label>
          <input type="number" min={-20} max={20} step={1} value={adj} onChange={e => setAdj(Number(e.target.value))}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Effective</label>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700 min-w-[60px] text-center">
            {effective}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-gray-500">Notes <span className="text-gray-400">(optional)</span></label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Context, observations, supporting evidence…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {existing?.updatedAt && (
          <p className="text-[10px] text-gray-400">
            Last updated {new Date(existing.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      <button onClick={handleSave} disabled={saving || saved}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
        {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="save" size="sm" />}
        {saved ? 'Saved' : saving ? 'Saving…' : 'Save prediction'}
      </button>
    </div>
  )
}

// ── Student drill-down slide-over ─────────────────────────────────────────────

function RagStudentPanel({
  student,
  onClose,
}: {
  student:  RagStudent
  onClose:  () => void
}) {
  const [file,    setFile]    = useState<StudentFileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [note,    setNote]    = useState('')
  const [saving,  startSave]  = useTransition()
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    getStudentFile(student.id).then(f => { setFile(f); setLoading(false) })
  }, [student.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveNote() {
    if (!note.trim()) return
    startSave(async () => {
      await saveStudentNote(student.id, note.trim())
      setNote('')
      setNoteSaved(true)
      const f = await getStudentFile(student.id)
      setFile(f)
      setTimeout(() => setNoteSaved(false), 2000)
    })
  }

  // Last 5 homework grades for sparkline (oldest → newest left-to-right)
  const sparkGrades = (file?.recentHomeworks ?? [])
    .filter(hw => hw.finalScore != null || hw.grade != null)
    .slice(0, 5)
    .reverse()
    .map(hw => {
      if (hw.grade) return Math.min(9, Math.max(1, Number(hw.grade)))
      return percentToGcseGrade(hw.finalScore ?? 0)
    })

  const activeTargets = file?.ilp?.targets.filter(t => t.status === 'active') ?? []
  const last3Hws      = file?.recentHomeworks.slice(0, 3) ?? []

  const ragCfg = {
    green:   { pillCls: 'bg-green-100 text-green-700',  label: 'On track'           },
    amber:   { pillCls: 'bg-amber-100 text-amber-700',  label: 'Slightly below'     },
    red:     { pillCls: 'bg-red-100 text-red-700',      label: 'Significantly below' },
    no_data: { pillCls: 'bg-gray-100 text-gray-500',    label: 'No data'            },
  }[student.ragStatus]

  const sendBadge: Record<string, string> = {
    EHCP: 'bg-purple-100 text-purple-700', SEN_SUPPORT: 'bg-blue-100 text-blue-700',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <StudentAvatar
            firstName={student.firstName}
            lastName={student.lastName}
            avatarUrl={student.avatarUrl}
            sendStatus={student.sendCategory as any}
            size="sm"
            userId={student.id}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {student.firstName} {student.lastName}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ragCfg.pillCls}`}>
                {ragCfg.label}
              </span>
              {student.hasSend && student.sendCategory && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sendBadge[student.sendCategory] ?? 'bg-gray-100 text-gray-600'}`}>
                  {student.sendCategory.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Grade summary */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Predicted', value: student.predictedGrade   != null ? gradeLabel(student.predictedGrade)   : '—' },
              { label: 'Working at', value: student.workingAtGrade  != null ? gradeLabel(student.workingAtGrade)   : '—' },
              { label: 'Last score', value: student.lastScore       != null ? gradeLabel(percentToGcseGrade(student.lastScore)) : '—' },
            ].map(c => (
              <div key={c.label} className="flex flex-col items-center py-4 gap-1">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider">{c.label}</span>
                <span className="text-lg font-bold text-gray-900">{c.value}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-gray-100">

              {/* Sparkline — grade trend */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Grade trend — last {sparkGrades.length} marked
                  </p>
                  {sparkGrades.length >= 2 && (
                    <span className="text-[11px] text-gray-400">
                      {gradeLabel(sparkGrades[0])} → {gradeLabel(sparkGrades[sparkGrades.length - 1])}
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-4">
                  <Sparkline grades={sparkGrades} />
                  {sparkGrades.length >= 2 && (
                    <span className={`text-xs font-semibold ${
                      sparkGrades[sparkGrades.length - 1] > sparkGrades[0] ? 'text-green-600'
                      : sparkGrades[sparkGrades.length - 1] < sparkGrades[0] ? 'text-rose-600'
                      : 'text-gray-400'
                    }`}>
                      {sparkGrades[sparkGrades.length - 1] > sparkGrades[0] ? '↑ Improving'
                       : sparkGrades[sparkGrades.length - 1] < sparkGrades[0] ? '↓ Declining'
                       : '→ Steady'}
                    </span>
                  )}
                </div>
              </div>

              {/* SEND + ILP targets */}
              {activeTargets.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">ILP Targets</p>
                  <div className="space-y-2">
                    {activeTargets.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <p className="text-sm text-gray-700">{t.target}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last 3 homeworks */}
              {last3Hws.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Homework</p>
                  <div className="space-y-2">
                    {last3Hws.map(hw => (
                      <div key={hw.homeworkId} className="flex items-center gap-2 text-sm">
                        <Icon
                          name={hw.submitted ? 'check_circle' : 'cancel'}
                          size="sm"
                          className={hw.submitted ? 'text-green-500 shrink-0' : 'text-gray-300 shrink-0'}
                        />
                        <span className="flex-1 text-gray-700 truncate min-w-0">{hw.title}</span>
                        <span className="text-gray-400 text-xs shrink-0">
                          {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-gray-800 font-medium text-xs shrink-0 w-14 text-right">
                          {hw.grade
                            ? gradeLabel(Number(hw.grade))
                            : hw.finalScore != null
                              ? formatRawScore(hw.finalScore)
                              : hw.submitted ? 'Submitted' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teacher notes */}
              <div className="px-5 py-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Teacher Notes</p>
                {file?.notes.slice(0, 3).map(n => (
                  <div key={n.id} className="mb-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-700">{n.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {n.authorName} · {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))}
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 mt-1"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={!note.trim() || saving}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="add" size="sm" />}
                  {noteSaved ? 'Saved!' : 'Add note'}
                </button>
              </div>

            </div>
          )}
        </div>

        {/* ── National average footer ── */}
        <div className="shrink-0 px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Icon name="public" size="sm" className="text-gray-300" />
            UK national average: Grade 4+ pass rate ≈ 67% · Grade 5+ ≈ 54%
          </p>
        </div>
      </div>
    </>
  )
}

// ── RAG row ───────────────────────────────────────────────────────────────────

function RagRow({
  student, subject, termLabel, expanded, onExpand, onSaved, onOpenPanel,
}: {
  student:     RagStudent
  subject:     string
  termLabel:   string
  expanded:    boolean
  onExpand:    () => void
  onSaved:     (studentId: string) => void
  onOpenPanel: () => void
}) {
  const effectivePredicted = student.prediction?.effectiveScore ?? student.baselineScore ?? null
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
        onClick={onOpenPanel}
        className="grid grid-cols-[1fr_auto_80px_80px_80px_80px_32px] items-center gap-2 px-4 py-3 border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors select-none"
      >
        {/* Name */}
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0" />
          <StudentAvatar
            firstName={student.firstName} lastName={student.lastName}
            avatarUrl={student.avatarUrl} sendStatus={student.sendCategory as any}
            size="xs" userId={student.id}
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
        <RagStatusDot status={student.ragStatus} />

        {/* Baseline */}
        <div className="text-right text-sm">{scoreCell(student.baselineScore)}</div>

        {/* Predicted */}
        <div className="text-right text-sm">{effectiveCell()}</div>

        {/* Working at */}
        <div className="text-right text-sm">{scoreCell(student.workingAtScore)}</div>

        {/* Last score */}
        <div className="text-right text-sm">{scoreCell(student.lastScore)}</div>

        {/* Edit prediction button — stops propagation so it doesn't open panel */}
        <button
          onClick={e => { e.stopPropagation(); onExpand() }}
          title="Edit teacher prediction"
          className={`p-1 rounded-md transition-colors ${
            expanded
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
          }`}
        >
          <Icon name="edit" size="sm" />
        </button>
      </div>

      {expanded && (
        <PredictionForm
          student={student} subject={subject} termLabel={termLabel} onSaved={onSaved}
        />
      )}
    </>
  )
}

// ── Main RagView ──────────────────────────────────────────────────────────────

type Props = { classId: string; subject: string; termLabel: string }

export default function RagView({ classId, subject, termLabel }: Props) {
  const [students,    setStudents]    = useState<RagStudent[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [ragFilter,   setRagFilter]   = useState<RagStatus | null>(null)
  const [panelStudent, setPanelStudent] = useState<RagStudent | null>(null)

  async function reload() {
    setLoading(true)
    const data = await getClassRagData(classId, termLabel)
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => { reload() }, [classId, termLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(studentId: string) {
    reload().then(() => setExpanded(studentId))
  }

  // ── Summary counts ──────────────────────────────────────────────────────────
  const green  = students.filter(s => s.ragStatus === 'green').length
  const amber  = students.filter(s => s.ragStatus === 'amber').length
  const red    = students.filter(s => s.ragStatus === 'red').length
  const noData = students.filter(s => s.ragStatus === 'no_data').length

  // National benchmark: % of class with workingAtGrade >= 4
  const withGrade  = students.filter(s => s.workingAtGrade != null)
  const grade4Plus = withGrade.filter(s => (s.workingAtGrade ?? 0) >= 4).length
  const classPassPct = withGrade.length > 0
    ? Math.round((grade4Plus / withGrade.length) * 100)
    : null

  // Filtered list
  const displayed = ragFilter ? students.filter(s => s.ragStatus === ragFilter) : students

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

  const chipDefs: { status: RagStatus; count: number; label: string; base: string; active: string; dot: string }[] = [
    { status: 'green',   count: green,  label: 'On Track',     base: 'bg-green-50 text-green-700 border-green-200',  active: 'ring-2 ring-green-400 bg-green-100',  dot: 'bg-green-500'  },
    { status: 'amber',   count: amber,  label: 'Developing',   base: 'bg-amber-50 text-amber-700 border-amber-200',  active: 'ring-2 ring-amber-400 bg-amber-100',  dot: 'bg-amber-400'  },
    { status: 'red',     count: red,    label: 'Needs Support', base: 'bg-red-50 text-red-700 border-red-200',        active: 'ring-2 ring-red-400 bg-red-100',      dot: 'bg-red-500'    },
    ...(noData > 0 ? [{ status: 'no_data' as RagStatus, count: noData, label: 'no data', base: 'bg-gray-50 text-gray-500 border-gray-200', active: 'ring-2 ring-gray-300 bg-gray-100', dot: 'bg-gray-300' }] : []),
  ]

  return (
    <div className="space-y-4">

      {/* ── Summary chips (clickable filter) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1">Progress summary</span>
        {chipDefs.map(({ status, count, label, base, active, dot }) => (
          <button
            key={status}
            type="button"
            onClick={() => setRagFilter(ragFilter === status ? null : status)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${base} ${ragFilter === status ? active : 'hover:opacity-80'}`}
            title={ragFilter === status ? 'Clear filter' : `Show only ${label}`}
          >
            <span className={`w-2 h-2 rounded-full inline-block ${dot}`} />
            {count} {label}
            {ragFilter === status && <Icon name="close" size="sm" className="ml-0.5 opacity-70" />}
          </button>
        ))}
        {ragFilter && (
          <button
            onClick={() => setRagFilter(null)}
            className="text-xs text-gray-400 hover:text-gray-600 ml-1 flex items-center gap-0.5"
          >
            <Icon name="filter_alt_off" size="sm" /> Clear filter
          </button>
        )}
        <span className="ml-auto text-[11px] text-gray-400">{termLabel}</span>
      </div>

      {/* ── National benchmark ── */}
      {classPassPct != null && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-[12px]">
          <Icon name="public" size="sm" className="text-blue-400 shrink-0" />
          <span className="text-blue-700">
            <strong>This class Grade 4+ pass rate: {classPassPct}%</strong>
            {' '}(based on working-at grades) ·{' '}
            <span className="text-blue-500">National average ≈ 67%</span>
          </span>
          {classPassPct >= 67
            ? <span className="ml-auto shrink-0 text-[11px] font-semibold text-green-600">▲ Above national</span>
            : <span className="ml-auto shrink-0 text-[11px] font-semibold text-rose-600">▼ Below national</span>
          }
        </div>
      )}

      {/* ── Active filter indicator ── */}
      {ragFilter && (
        <div className="text-[12px] text-gray-500">
          Showing <strong>{displayed.length}</strong> of {students.length} students
          {ragFilter !== 'no_data' ? ` · filtered to "${RAG_LABEL[ragFilter]}"` : ' · no prediction data'}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_80px_80px_80px_80px_32px] items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span>Student</span>
          <span>Status</span>
          <span className="text-right">Baseline</span>
          <span className="text-right">Predicted</span>
          <span className="text-right">Working at</span>
          <span className="text-right">Last score</span>
          <span title="Edit prediction"><Icon name="edit" size="sm" /></span>
        </div>

        {displayed.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No students in this category.</div>
        ) : (
          displayed.map(s => (
            <RagRow
              key={s.id}
              student={s}
              subject={subject}
              termLabel={termLabel}
              expanded={expanded === s.id}
              onExpand={() => setExpanded(expanded === s.id ? null : s.id)}
              onSaved={handleSaved}
              onOpenPanel={() => setPanelStudent(s)}
            />
          ))
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Click a row to view student details · Click <Icon name="edit" size="sm" className="inline-block align-text-bottom" /> to enter or update a teacher prediction.
      </p>

      {/* ── Student drill-down slide-over ── */}
      {panelStudent && (
        <RagStudentPanel
          student={panelStudent}
          onClose={() => setPanelStudent(null)}
        />
      )}
    </div>
  )
}
