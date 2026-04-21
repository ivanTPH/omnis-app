'use client'
import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'
import { formatRawScore } from '@/lib/gradeUtils'
import {
  StudentFileData, KPlanDoc, IlpDoc, EhcpDoc, SubjectPerf,
  HomeworkHistoryRow, NoteRow, StudentContact, WondeAttendanceSummary,
  LearningPassportDoc,
  saveStudentNote, deleteStudentNote, requestKPlanAmendment, applyKPlanEdit,
  generateRevisionSuggestions, approveLearningPassport,
} from '@/app/actions/students'
import type { ApdrRow } from '@/app/actions/send-support'
import {
  updateAPDRSection, approveAPDR, completeAPDRReview, generateAPDRForStudent,
} from '@/app/actions/send-support'
import {
  getStudentAssessments, addAssessment, deleteAssessment,
  type AssessmentRow,
} from '@/app/actions/assessments'
import { ASSESSMENT_TYPES } from '@/lib/assessment-types'

// ── Tab type ─────────────────────────────────────────────────────────────────
type Tab = 'Overview' | 'Plans' | 'APDR' | 'Homework' | 'Assessments' | 'Notes' | 'Contact'
const TABS: Tab[] = ['Overview', 'Plans', 'APDR', 'Homework', 'Assessments', 'Notes', 'Contact']
const TAB_ICONS: Record<Tab, string> = {
  Overview:    'person',
  Plans:       'description',
  APDR:        'loop',
  Homework:    'assignment',
  Assessments: 'fact_check',
  Notes:       'note_alt',
  Contact:     'contacts',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:        'bg-emerald-100 text-emerald-700',
    APPROVED:      'bg-emerald-100 text-emerald-700',
    under_review:  'bg-amber-100 text-amber-700',
    UNDER_REVIEW:  'bg-amber-100 text-amber-700',
    DRAFT:         'bg-gray-100 text-gray-600',
    draft:         'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function RagDot({ rag }: { rag: 'green' | 'amber' | 'red' | null }) {
  if (!rag) return null
  const colors = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500' }
  const labels = { green: 'On Track', amber: 'Developing', red: 'Needs Support' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[rag]}`} />
      <span className="text-xs text-gray-600">{labels[rag]}</span>
    </span>
  )
}

// ── Learning Passport Section ──────────────────────────────────────────────────

function LearningPassportSection({
  passport, isSenco, studentId,
}: { passport: LearningPassportDoc; isSenco: boolean; studentId: string }) {
  const [approving, startApprove] = useTransition()
  const [approved, setApproved]   = useState(passport.approvedByTeacher)
  const isDraft = passport.passportStatus === 'DRAFT' && !approved

  function handleApprove() {
    startApprove(async () => {
      await approveLearningPassport(studentId)
      setApproved(true)
    })
  }

  return (
    <div className="space-y-4">
      {/* Grade summary */}
      {(passport.workingAtGrade != null || passport.predictedGrade != null) && (
        <div className="grid grid-cols-3 gap-3">
          {passport.workingAtGrade != null && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Working at</p>
              <p className="text-lg font-bold text-gray-900">Grade {passport.workingAtGrade}</p>
            </div>
          )}
          {passport.targetGrade != null && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500 mb-1">Target</p>
              <p className="text-lg font-bold text-blue-700">Grade {passport.targetGrade}</p>
            </div>
          )}
          {passport.predictedGrade != null && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Predicted</p>
              <p className="text-lg font-bold text-gray-900">Grade {passport.predictedGrade}</p>
            </div>
          )}
        </div>
      )}

      {passport.strengthAreas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Strengths</p>
          <ul className="space-y-1">
            {passport.strengthAreas.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {passport.developmentAreas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Areas for development</p>
          <ul className="space-y-1">
            {passport.developmentAreas.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {passport.classroomStrategies.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Classroom strategies</p>
          <ul className="space-y-1">
            {passport.classroomStrategies.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <Icon name="check_circle" size="sm" className="text-blue-400 shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {passport.learningFormatNotes && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Learning format notes</p>
          <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {passport.learningFormatNotes}
          </p>
        </div>
      )}

      {isDraft && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700">This passport is a draft — approve to confirm the strategies.</p>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {approving
              ? <Icon name="refresh" size="sm" className="animate-spin" />
              : <Icon name="verified" size="sm" />}
            {approving ? 'Approving…' : 'Approve passport'}
          </button>
        </div>
      )}
      {approved && passport.approvedAt && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Icon name="verified" size="sm" className="text-green-500" />
          Approved {new Date(passport.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
      {passport.lastUpdated && (
        <p className="text-xs text-gray-400">
          Last updated {new Date(passport.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function KPlanSection({ kPlan, isSenco, studentId }: { kPlan: KPlanDoc; isSenco: boolean; studentId: string }) {
  const [mode, setMode] = useState<'view' | 'edit-senco' | 'request'>('view')
  const [pending, startTransition] = useTransition()
  const [sendInfo, setSendInfo] = useState(kPlan.sendInformation)
  const [actions, setActions] = useState<string[]>(kPlan.teacherActions)
  const [commitments, setCommitments] = useState<string[]>(kPlan.studentCommitments)
  const [newAction, setNewAction] = useState('')
  const [newCommitment, setNewCommitment] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSencoSave() {
    startTransition(async () => {
      await applyKPlanEdit(kPlan.id, { sendInformation: sendInfo, teacherActions: actions, studentCommitments: commitments }, studentId)
      setSaved(true)
      setTimeout(() => { setSaved(false); setMode('view') }, 1200)
    })
  }

  function handleRequest() {
    if (!requestNote.trim()) return
    startTransition(async () => {
      await requestKPlanAmendment(kPlan.id, requestNote, studentId)
      setRequestNote('')
      setMode('view')
    })
  }

  if (mode === 'edit-senco') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">SEN Information</label>
          <textarea
            value={sendInfo}
            onChange={e => setSendInfo(e.target.value)}
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Teacher Actions</label>
          <div className="space-y-1 mb-2">
            {actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={a}
                  onChange={e => { const copy = [...actions]; copy[i] = e.target.value; setActions(copy) }}
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                />
                <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                  <Icon name="remove_circle_outline" size="sm" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newAction}
              onChange={e => setNewAction(e.target.value)}
              placeholder="Add action…"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
              onKeyDown={e => { if (e.key === 'Enter' && newAction.trim()) { setActions([...actions, newAction.trim()]); setNewAction('') } }}
            />
            <button onClick={() => { if (newAction.trim()) { setActions([...actions, newAction.trim()]); setNewAction('') } }} className="text-blue-600 text-sm">Add</button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Student Commitments</label>
          <div className="space-y-1 mb-2">
            {commitments.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={c}
                  onChange={e => { const copy = [...commitments]; copy[i] = e.target.value; setCommitments(copy) }}
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                />
                <button onClick={() => setCommitments(commitments.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                  <Icon name="remove_circle_outline" size="sm" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCommitment}
              onChange={e => setNewCommitment(e.target.value)}
              placeholder="Add commitment…"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
              onKeyDown={e => { if (e.key === 'Enter' && newCommitment.trim()) { setCommitments([...commitments, newCommitment.trim()]); setNewCommitment('') } }}
            />
            <button onClick={() => { if (newCommitment.trim()) { setCommitments([...commitments, newCommitment.trim()]); setNewCommitment('') } }} className="text-blue-600 text-sm">Add</button>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSencoSave}
            disabled={pending}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saved ? 'Saved ✓' : pending ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={() => setMode('view')} className="px-4 py-1.5 text-gray-600 text-sm">Cancel</button>
        </div>
      </div>
    )
  }

  if (mode === 'request') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Describe the changes you&apos;d like the SENCO to make to this K Plan:</p>
        <textarea
          value={requestNote}
          onChange={e => setRequestNote(e.target.value)}
          rows={4}
          placeholder="e.g. Please update teacher actions to include extra processing time during exams…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-3">
          <button onClick={handleRequest} disabled={pending || !requestNote.trim()} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {pending ? 'Sending…' : 'Send request'}
          </button>
          <button onClick={() => setMode('view')} className="text-gray-600 text-sm px-4 py-1.5">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">SEN Information</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{kPlan.sendInformation || '—'}</p>
      </div>
      {kPlan.teacherActions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Teacher Actions</p>
          <ul className="space-y-1">
            {kPlan.teacherActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kPlan.studentCommitments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Student Commitments</p>
          <ul className="space-y-1">
            {kPlan.studentCommitments.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kPlan.additionalSupportStrategies.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Additional Support Strategies</p>
          <ul className="space-y-1">
            {kPlan.additionalSupportStrategies.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <Icon name="support_agent" size="sm" className="text-purple-400 shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kPlan.equipmentRequired.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Equipment Required</p>
          <div className="flex flex-wrap gap-1.5">
            {kPlan.equipmentRequired.map((e, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{e}</span>
            ))}
          </div>
        </div>
      )}
      {kPlan.reviewDate && (
        <div className="text-sm text-gray-600">
          <span className="text-xs text-gray-500 mr-1">Next review:</span>
          {new Date(kPlan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      )}
      {isSenco && kPlan.staffNotes && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-amber-700 mb-1">Staff notes (SENCO only)</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{kPlan.staffNotes}</p>
        </div>
      )}
      <div className="flex gap-2">
        {isSenco
          ? <button onClick={() => setMode('edit-senco')} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"><Icon name="edit" size="sm" />Edit K Plan</button>
          : <button onClick={() => setMode('request')} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"><Icon name="edit_note" size="sm" />Request amendment</button>
        }
      </div>
    </div>
  )
}

function IlpSection({ ilp, isSenco, studentId }: { ilp: IlpDoc; isSenco: boolean; studentId: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-xs text-gray-500 block">Category</span>{ilp.sendCategory}</div>
        <div><span className="text-xs text-gray-500 block">Review date</span>{ilp.reviewDate ? new Date(ilp.reviewDate).toLocaleDateString('en-GB') : 'Not set'}</div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Areas of need</p>
        <p className="text-sm text-gray-800">{ilp.areasOfNeed}</p>
      </div>
      {ilp.targets.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800"
          >
            <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" />
            {ilp.targets.length} SMART target{ilp.targets.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="mt-2 space-y-3">
              {ilp.targets.map(t => (
                <div key={t.id} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-800 mb-1">{t.target}</p>
                  {t.strategy && <p className="text-xs text-gray-600"><span className="font-medium">Strategy:</span> {t.strategy}</p>}
                  {t.successMeasure && <p className="text-xs text-gray-600"><span className="font-medium">Success:</span> {t.successMeasure}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={t.status} />
                    {t.targetDate && <span className="text-xs text-gray-500">{new Date(t.targetDate).toLocaleDateString('en-GB')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {isSenco ? (
        <a href="/senco/ilp" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <Icon name="open_in_new" size="sm" />Edit full ILP
        </a>
      ) : (
        <a href={`/student/${studentId}/send`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <Icon name="open_in_new" size="sm" />View full SEND profile
        </a>
      )}
    </div>
  )
}

function EhcpSection({ ehcp, isSenco }: { ehcp: EhcpDoc; isSenco: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const sections = ehcp.sections ?? {}
  const sectionEntries = Object.entries(sections).filter(([, v]) => v?.trim())
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-xs text-gray-500 block">Review date</span>{ehcp.reviewDate ? new Date(ehcp.reviewDate).toLocaleDateString('en-GB') : 'Not set'}</div>
        <div><span className="text-xs text-gray-500 block">Approved</span>{ehcp.approvedAt ? new Date(ehcp.approvedAt).toLocaleDateString('en-GB') : 'Pending'}</div>
      </div>
      {sectionEntries.length > 0 && (
        <div>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800">
            <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" />
            {sectionEntries.length} section{sectionEntries.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {sectionEntries.map(([key, value]) => (
                <div key={key} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Section {key}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {ehcp.outcomes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{ehcp.outcomes.length} outcome{ehcp.outcomes.length !== 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {ehcp.outcomes.slice(0, 3).map(o => (
              <div key={o.id} className="flex items-start gap-2">
                <StatusBadge status={o.status} />
                <p className="text-sm text-gray-800">{o.outcomeText}</p>
              </div>
            ))}
            {ehcp.outcomes.length > 3 && (
              <p className="text-xs text-gray-500">{ehcp.outcomes.length - 3} more outcomes…</p>
            )}
          </div>
        </div>
      )}
      {isSenco && (
        <a href="/senco/ehcp" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <Icon name="open_in_new" size="sm" />Edit full EHCP
        </a>
      )}
    </div>
  )
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({ data, studentName, onClose }: { data: StudentFileData; studentName: string; onClose?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string | null>(null)
  const [loadingSugg, startSuggTransition] = useTransition()

  function loadSuggestions() {
    startSuggTransition(async () => {
      const result = await generateRevisionSuggestions(studentName, data.subjectPerf)
      setSuggestions(result)
    })
  }

  const subjectHw = (subject: string) =>
    data.recentHomeworks.filter(h => h.subject === subject)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{data.completionRate}%</p>
          <p className="text-xs text-gray-500 mt-0.5">Completion rate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{data.avgScore != null ? formatRawScore(data.avgScore) : '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Avg score</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{data.recentHomeworks.filter(h => h.submitted).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Submitted</p>
        </div>
      </div>

      {/* Subject RAG */}
      {data.subjectPerf.length > 0 && (
        <SectionCard title="Performance by subject">
          <div className="divide-y divide-gray-50">
            {data.subjectPerf.map(row => (
              <div key={row.subject}>
                <button
                  onClick={() => setExpanded(expanded === row.subject ? null : row.subject)}
                  className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 px-1 rounded"
                >
                  <div className="flex items-center gap-3">
                    <Icon name={expanded === row.subject ? 'expand_less' : 'expand_more'} size="sm" color="#9ca3af" />
                    <span className="text-sm font-medium text-gray-800">{row.subject}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {row.avgScore != null && (
                      <span className="text-sm text-gray-600">{formatRawScore(row.avgScore)} avg</span>
                    )}
                    {row.predictedScore != null && (
                      <span className="text-xs text-gray-400">pred. {formatRawScore(row.predictedScore)}</span>
                    )}
                    <RagDot rag={row.rag} />
                  </div>
                </button>
                {expanded === row.subject && (
                  <div className="pb-3 px-7">
                    <div className="text-xs text-gray-500 mb-2">
                      {row.assigned} assigned · {row.submitted} submitted
                      {row.baselineScore != null && ` · baseline ${formatRawScore(row.baselineScore)}`}
                    </div>
                    <div className="space-y-1">
                      {subjectHw(row.subject).slice(0, 8).map(hw => (
                        <a
                          key={hw.homeworkId}
                          href={hw.submissionId
                            ? `/homework/${hw.homeworkId}/mark/${hw.submissionId}`
                            : `/homework/${hw.homeworkId}`}
                          className="flex items-center justify-between text-xs py-0.5 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                        >
                          <span className="text-blue-700 hover:underline truncate max-w-[60%]">{hw.title}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">{new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            {hw.finalScore != null
                              ? <span className="font-medium text-gray-800">{formatRawScore(hw.finalScore)}</span>
                              : hw.submitted
                                ? <span className="text-blue-600">Submitted</span>
                                : <span className="text-red-500">Missing</span>
                            }
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* AI revision suggestions */}
      <SectionCard
        title="AI revision suggestions"
        action={
          !suggestions ? (
            <button
              onClick={loadSuggestions}
              disabled={loadingSugg}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
            >
              <Icon name={loadingSugg ? 'refresh' : 'auto_awesome'} size="sm" className={loadingSugg ? 'animate-spin' : ''} />
              {loadingSugg ? 'Generating…' : 'Generate'}
            </button>
          ) : undefined
        }
      >
        {suggestions
          ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{suggestions}</p>
          : <p className="text-sm text-gray-400">Click Generate to get AI-powered revision recommendations based on this student&apos;s performance.</p>
        }
      </SectionCard>
    </div>
  )
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ notes, studentId }: { notes: NoteRow[]; studentId: string }) {
  const [text, setText] = useState('')
  const [localNotes, setLocalNotes] = useState(notes)
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    if (!text.trim()) return
    startTransition(async () => {
      await saveStudentNote(studentId, text)
      setText('')
      // Optimistically we just reload; next navigation will refresh
    })
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      await deleteStudentNote(noteId, studentId)
      setLocalNotes(prev => prev.filter(n => n.id !== noteId))
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-800">Add note</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Write a note about this student…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={pending || !text.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>

      {localNotes.length === 0
        ? <p className="text-sm text-gray-400 text-center py-8">No notes yet.</p>
        : (
          <div className="space-y-2">
            {localNotes.map(n => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-800 flex-1 whitespace-pre-wrap">{n.content}</p>
                  <button onClick={() => handleDelete(n.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                    <Icon name="delete_outline" size="sm" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">{n.authorName} · {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── Contacts Tab ──────────────────────────────────────────────────────────────

function ContactsTab({ student, parentContacts }: { student: StudentFileData['student']; parentContacts: StudentContact[] }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Student">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Icon name="email" size="sm" color="#9ca3af" />
            <span className="text-gray-800">{student.email}</span>
          </div>
          {student.phone && (
            <div className="flex items-center gap-2">
              <Icon name="phone" size="sm" color="#9ca3af" />
              <span className="text-gray-800">{student.phone}</span>
            </div>
          )}
          {student.yearGroup && (
            <div className="flex items-center gap-2">
              <Icon name="school" size="sm" color="#9ca3af" />
              <span className="text-gray-800">Year {student.yearGroup}</span>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Parent / Carer contacts">
        {parentContacts.length === 0
          ? <p className="text-sm text-gray-400">No parent/carer contacts linked.</p>
          : (
            <div className="divide-y divide-gray-50 -my-1">
              {parentContacts.map((c, i) => (
                <div key={i} className="py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    {c.relationship && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{c.relationship}</span>
                    )}
                    {c.source === 'wonde' && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">MIS</span>
                    )}
                  </div>
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Icon name="email" size="sm" color="#9ca3af" />
                      <a href={`mailto:${c.email}`} className="text-sm text-blue-600 hover:underline">{c.email}</a>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Icon name="phone" size="sm" color="#9ca3af" />
                      <span className="text-sm text-gray-700">{c.phone}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </SectionCard>
    </div>
  )
}

// ── APDR Tab ──────────────────────────────────────────────────────────────────

type ApdrSection = 'assessContent' | 'planContent' | 'doContent' | 'reviewContent'

function ApdrSectionEditor({
  label, value, apdrId, section, canEdit, placeholder,
}: {
  label: string
  value: string
  apdrId: string
  section: ApdrSection
  canEdit: boolean
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await updateAPDRSection(apdrId, section, draft)
      setSaved(true)
      setTimeout(() => { setSaved(false); setEditing(false) }, 1200)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {canEdit && !editing && (
          <button
            onClick={() => { setDraft(value); setEditing(true) }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <Icon name="edit" size="sm" />Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            placeholder={placeholder}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saved ? 'Saved ✓' : pending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-600 text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || <span className="text-gray-400 italic">{placeholder ?? 'Not yet completed.'}</span>}</p>
      )}
    </div>
  )
}

function ApdrCycleCard({
  cycle, isSenco, isTA, studentId,
}: {
  cycle: ApdrRow
  isSenco: boolean
  isTA: boolean
  studentId: string
}) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(cycle.reviewContent ?? '')
  const [completing, startCompleteTransition] = useTransition()
  const [approving, startApproveTransition] = useTransition()
  const [approved, setApproved] = useState(cycle.approvedBySenco)
  const isActive  = cycle.status === 'ACTIVE'
  const isComplete = cycle.status === 'COMPLETED'

  function handleApprove() {
    startApproveTransition(async () => {
      await approveAPDR(cycle.id)
      setApproved(true)
    })
  }

  function handleCompleteReview() {
    startCompleteTransition(async () => {
      await completeAPDRReview(cycle.id, reviewDraft)
      setShowReviewForm(false)
    })
  }

  const statusColors: Record<string, string> = {
    ACTIVE:    'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-gray-800">Cycle {cycle.cycleNumber}</h3>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[cycle.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {cycle.status.toLowerCase()}
          </span>
          {approved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              <Icon name="verified" size="sm" />Approved
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          Review due: {new Date(cycle.reviewDate).toLocaleDateString('en-GB')}
        </span>
      </div>
      <div className="px-5 py-4 space-y-5">
        <ApdrSectionEditor
          label="Assess"
          value={cycle.assessContent}
          apdrId={cycle.id}
          section="assessContent"
          canEdit={isSenco && isActive}
          placeholder="Current assessment: strengths, areas of need, baseline data."
        />
        <ApdrSectionEditor
          label="Plan"
          value={cycle.planContent}
          apdrId={cycle.id}
          section="planContent"
          canEdit={isSenco && isActive}
          placeholder="Strategies, targets, TA support and monitoring approach."
        />
        <ApdrSectionEditor
          label="Do — observations & notes"
          value={cycle.doContent}
          apdrId={cycle.id}
          section="doContent"
          canEdit={(isSenco || isTA) && isActive}
          placeholder="Add observations during this cycle — what is working, what needs adjustment."
        />
        {(isSenco || cycle.reviewContent) && (
          <ApdrSectionEditor
            label="Review"
            value={cycle.reviewContent ?? ''}
            apdrId={cycle.id}
            section="reviewContent"
            canEdit={isSenco && isActive}
            placeholder="End-of-cycle review: impact on progress, next steps."
          />
        )}

        {isSenco && isActive && !approved && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Icon name="check_circle" size="sm" />
            {approving ? 'Approving…' : 'Approve APDR'}
          </button>
        )}

        {isSenco && isActive && !showReviewForm && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
          >
            <Icon name="rate_review" size="sm" />Complete review &amp; start next cycle
          </button>
        )}

        {isSenco && isActive && showReviewForm && (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700">Review notes (saved on completion)</p>
            <textarea
              value={reviewDraft}
              onChange={e => setReviewDraft(e.target.value)}
              rows={4}
              placeholder="Summarise impact of this cycle and recommendations for next cycle…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCompleteReview}
                disabled={completing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Icon name="done_all" size="sm" />
                {completing ? 'Completing…' : 'Mark complete + start next cycle'}
              </button>
              <button onClick={() => setShowReviewForm(false)} className="px-3 py-1.5 text-gray-600 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {isComplete && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Icon name="check" size="sm" />Cycle completed
          </p>
        )}
      </div>
    </div>
  )
}

function ApdrTab({
  cycles, isSenco, isTA, studentId,
}: {
  cycles: ApdrRow[]
  isSenco: boolean
  isTA: boolean
  studentId: string
}) {
  const [generating, startGenerateTransition] = useTransition()

  function handleGenerate() {
    startGenerateTransition(async () => {
      await generateAPDRForStudent(studentId)
    })
  }

  if (cycles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center">
          <Icon name="loop" size="lg" color="#d1d5db" />
          <p className="text-sm text-gray-500 mt-2">No APDR cycles on file.</p>
          {isSenco && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Icon name={generating ? 'refresh' : 'auto_awesome'} size="sm" className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating…' : 'Generate APDR from ILP'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {isSenco && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            <Icon name={generating ? 'refresh' : 'add_circle_outline'} size="sm" className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating…' : 'New cycle from ILP'}
          </button>
        </div>
      )}
      {cycles.map(cycle => (
        <ApdrCycleCard
          key={cycle.id}
          cycle={cycle}
          isSenco={isSenco}
          isTA={isTA}
          studentId={studentId}
        />
      ))}
    </div>
  )
}

// ── Assessments Tab ───────────────────────────────────────────────────────────

const GRADE_COLORS: Record<number, string> = {
  9: 'bg-emerald-100 text-emerald-800',
  8: 'bg-emerald-100 text-emerald-700',
  7: 'bg-green-100 text-green-700',
  6: 'bg-lime-100 text-lime-700',
  5: 'bg-yellow-100 text-yellow-700',
  4: 'bg-amber-100 text-amber-700',
  3: 'bg-orange-100 text-orange-700',
  2: 'bg-red-100 text-red-600',
  1: 'bg-red-200 text-red-700',
}

function AssessmentTab({ studentId, classIds }: { studentId: string; classIds?: string[] }) {
  const [rows,          setRows]          = useState<AssessmentRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [pending,       startTransition]  = useTransition()

  // Form state
  const [title,          setTitle]          = useState('')
  const [assessmentType, setAssessmentType] = useState('end_of_unit')
  const [score,          setScore]          = useState<number>(5)
  const [date,           setDate]           = useState(() => new Date().toISOString().split('T')[0])
  const [notes,          setNotes]          = useState('')

  useEffect(() => {
    setLoading(true)
    getStudentAssessments(studentId)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [studentId])

  function handleAdd() {
    if (!title.trim()) return
    startTransition(async () => {
      await addAssessment({ studentId, title: title.trim(), assessmentType, score, date, notes: notes.trim() || undefined })
      const updated = await getStudentAssessments(studentId)
      setRows(updated)
      setTitle(''); setNotes(''); setScore(5); setShowForm(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAssessment(id)
      setRows(prev => prev.filter(r => r.id !== id))
    })
  }

  const GRADE_LABEL: Record<number, string> = { 9:'A**', 8:'A*', 7:'A', 6:'B', 5:'C+', 4:'C', 3:'D', 2:'E', 1:'F' }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition"
        >
          <Icon name={showForm ? 'remove' : 'add'} size="sm" />
          {showForm ? 'Cancel' : 'Add assessment'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-[12px] font-bold text-gray-700 uppercase tracking-widest">New assessment record</p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. End of Unit Test — An Inspector Calls"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select
                value={assessmentType}
                onChange={e => setAssessmentType(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ASSESSMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Grade (GCSE 1–9)</label>
            <div className="flex gap-1.5 flex-wrap">
              {[9,8,7,6,5,4,3,2,1].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setScore(g)}
                  className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition-all ${
                    score === g
                      ? `${GRADE_COLORS[g]} border-current scale-110`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any context or observations…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={pending || !title.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save assessment'}
          </button>
        </div>
      )}

      {/* Records list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center">
          <Icon name="fact_check" size="lg" color="#d1d5db" />
          <p className="text-sm text-gray-400 mt-2">No assessment records yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click &quot;Add assessment&quot; to record a test or exam score.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
              {/* Grade badge */}
              <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm ${GRADE_COLORS[r.score] ?? 'bg-gray-100 text-gray-700'}`}>
                <span className="text-lg leading-none">{r.score}</span>
                <span className="text-[10px] leading-none opacity-80">{GRADE_LABEL[r.score] ?? ''}</span>
              </div>
              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">{r.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  <span className="text-[11px] text-gray-500">
                    {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {ASSESSMENT_TYPES.find(t => t.value === r.assessmentType)?.label ?? r.assessmentType}
                  </span>
                  {r.className && <span className="text-[11px] text-gray-400">{r.className}</span>}
                </div>
                {r.notes && <p className="text-[12px] text-gray-600 mt-1 italic">{r.notes}</p>}
              </div>
              {/* Delete */}
              <button
                onClick={() => handleDelete(r.id)}
                disabled={pending}
                className="shrink-0 p-1 hover:bg-red-50 rounded-lg transition text-gray-300 hover:text-red-500"
                title="Delete record"
              >
                <Icon name="delete" size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentFilePanel({ data, role, onClose }: { data: StudentFileData; role: string; onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)
  const isTA    = role === 'TA'
  const { student } = data
  const studentName = `${student.firstName} ${student.lastName}`

  const sendBadgeColor: Record<string, string> = {
    EHCP:        'bg-purple-100 text-purple-700',
    SEN_SUPPORT: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Compact header — just name + avatar */}
      <div className="flex items-center gap-3 mb-5">
        <StudentAvatar
          firstName={student.firstName}
          lastName={student.lastName}
          avatarUrl={student.avatarUrl}
          size="md"
          sendStatus={student.sendStatus as 'EHCP' | 'SEN_SUPPORT' | 'NONE' | null | undefined}
          userId={student.id}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{studentName}</h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {student.yearGroup && <span className="text-xs text-gray-500">Year {student.yearGroup}</span>}
            {student.tutorGroup && <span className="text-xs text-gray-400">· {student.tutorGroup}</span>}
            {student.sendStatus && student.sendStatus !== 'NONE' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sendBadgeColor[student.sendStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                {student.sendStatus.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-5 border-b border-gray-200 overflow-x-auto scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name={TAB_ICONS[tab]} size="sm" />
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'Overview' && (
        <div className="space-y-4">
          {/* Student details card */}
          <SectionCard title="Student details">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Full name</p>
                <p className="font-medium text-gray-900">{studentName}</p>
              </div>
              {student.yearGroup && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Year group</p>
                  <p className="font-medium text-gray-900">Year {student.yearGroup}</p>
                </div>
              )}
              {student.tutorGroup && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Tutor group</p>
                  <p className="font-medium text-gray-900">{student.tutorGroup}</p>
                </div>
              )}
              {student.dateOfBirth && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Date of birth</p>
                  <p className="font-medium text-gray-900">
                    {new Date(student.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Email</p>
                <p className="font-medium text-gray-900 truncate">{student.email}</p>
              </div>
              {student.phone && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                  <p className="font-medium text-gray-900">{student.phone}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* SEND status */}
          {(student.sendStatus && student.sendStatus !== 'NONE') && (
            <SectionCard title="SEND status">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${sendBadgeColor[student.sendStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                  {student.sendStatus.replace('_', ' ')}
                </span>
                {student.needArea && (
                  <span className="text-sm text-gray-700">{student.needArea}</span>
                )}
              </div>
            </SectionCard>
          )}

          {/* Wonde MIS data */}
          {(student.attendancePercentage != null || student.behaviourPositive != null || student.hasExclusion || data.wondeAttendance != null) && (
            <SectionCard title="MIS data · via Wonde">
              <div className="space-y-2">
                {student.attendancePercentage != null && (() => {
                  const pct = student.attendancePercentage!
                  const dot = pct >= 95 ? 'bg-green-500' : pct >= 90 ? 'bg-amber-400' : 'bg-red-500'
                  const cls = pct >= 95 ? 'text-green-700' : pct >= 90 ? 'text-amber-700' : 'text-red-700'
                  const label = pct >= 95 ? 'On Track' : pct >= 90 ? 'Developing' : 'Needs Support'
                  return (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Attendance this term</span>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className={`font-semibold ${cls}`}>{pct.toFixed(1)}%</span>
                        <span className={`text-xs ${cls}`}>{label}</span>
                      </span>
                    </div>
                  )
                })()}
                {data.wondeAttendance != null && (() => {
                  const att = data.wondeAttendance!
                  const absent = (att.possibleSessions ?? 0) - (att.presentSessions ?? 0)
                  return (
                    <div className="space-y-1 pl-4 border-l-2 border-gray-100">
                      {att.possibleSessions != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Sessions absent</span>
                          <span className="font-medium text-gray-800">{absent} of {att.possibleSessions}</span>
                        </div>
                      )}
                      {att.authorisedAbsences != null && att.authorisedAbsences > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Authorised</span>
                          <span className="font-medium text-gray-800">{att.authorisedAbsences}</span>
                        </div>
                      )}
                      {att.unauthorisedAbsences != null && att.unauthorisedAbsences > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Unauthorised</span>
                          <span className="font-medium text-amber-700">{att.unauthorisedAbsences}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
                {student.behaviourPositive != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Behaviour</span>
                    <span className="font-medium text-gray-800">
                      {student.behaviourPositive} positive · {student.behaviourNegative ?? 0} concerns
                    </span>
                  </div>
                )}
                {student.hasExclusion && (
                  <div className="flex items-center gap-1.5 text-sm text-amber-700">
                    <Icon name="report_problem" size="sm" className="text-amber-500" />
                    Exclusion on record
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Tab: Plans ── */}
      {activeTab === 'Plans' && (
        <div className="space-y-4">
          {!data.learningPassport && !data.kPlan && !data.ilp && !data.ehcp && (
            <p className="text-sm text-gray-400 text-center py-8">No SEND documents on file for this student.</p>
          )}
          {data.learningPassport && (
            <SectionCard
              title="Learning Passport"
              action={
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  data.learningPassport.passportStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {data.learningPassport.passportStatus === 'APPROVED' ? 'Approved' : 'Draft'}
                </span>
              }
            >
              <LearningPassportSection
                passport={data.learningPassport}
                isSenco={isSenco}
                studentId={student.id}
              />
            </SectionCard>
          )}
          {data.kPlan && (
            <SectionCard title="K Plan" action={<StatusBadge status={data.kPlan.status} />}>
              <KPlanSection kPlan={data.kPlan} isSenco={isSenco} studentId={student.id} />
            </SectionCard>
          )}
          {data.ilp && (
            <SectionCard title="Individual Learning Plan (ILP)" action={<StatusBadge status={data.ilp.status} />}>
              <IlpSection ilp={data.ilp} isSenco={isSenco} studentId={student.id} />
            </SectionCard>
          )}
          {data.ehcp && (
            <SectionCard title="Education, Health and Care Plan (EHCP)" action={<StatusBadge status={data.ehcp.status} />}>
              <EhcpSection ehcp={data.ehcp} isSenco={isSenco} />
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Tab: APDR ── */}
      {activeTab === 'APDR' && (
        <ApdrTab
          cycles={data.apdrCycles}
          isSenco={isSenco}
          isTA={isTA}
          studentId={student.id}
        />
      )}

      {/* ── Tab: Homework ── */}
      {activeTab === 'Homework' && (
        <PerformanceTab data={data} studentName={studentName} onClose={onClose} />
      )}

      {/* ── Tab: Assessments ── */}
      {activeTab === 'Assessments' && (
        <AssessmentTab studentId={student.id} />
      )}

      {/* ── Tab: Notes ── */}
      {activeTab === 'Notes' && (
        <NotesTab notes={data.notes} studentId={student.id} />
      )}

      {/* ── Tab: Contact ── */}
      {activeTab === 'Contact' && (
        <ContactsTab student={student} parentContacts={data.parentContacts} />
      )}
    </div>
  )
}
