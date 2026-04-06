'use client'
import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'
import { formatRawScore } from '@/lib/gradeUtils'
import {
  StudentFileData, KPlanDoc, IlpDoc, EhcpDoc, SubjectPerf,
  HomeworkHistoryRow, NoteRow, StudentContact,
  saveStudentNote, deleteStudentNote, requestKPlanAmendment, applyKPlanEdit,
  generateRevisionSuggestions,
} from '@/app/actions/students'

// ── Tab type ─────────────────────────────────────────────────────────────────
type Tab = 'Overview' | 'Plans' | 'Homework' | 'Notes' | 'Contact'
const TABS: Tab[] = ['Overview', 'Plans', 'Homework', 'Notes', 'Contact']
const TAB_ICONS: Record<Tab, string> = {
  Overview: 'person',
  Plans:    'description',
  Homework: 'assignment',
  Notes:    'note_alt',
  Contact:  'contacts',
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
  const labels = { green: 'On track', amber: 'Borderline', red: 'Needs support' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[rag]}`} />
      <span className="text-xs text-gray-600">{labels[rag]}</span>
    </span>
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
      {isSenco && (
        <a href="/senco/ilp" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <Icon name="open_in_new" size="sm" />Edit full ILP
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

function PerformanceTab({ data, studentName }: { data: StudentFileData; studentName: string }) {
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
                        <div key={hw.homeworkId} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-gray-700 truncate max-w-[60%]">{hw.title}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">{new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            {hw.finalScore != null
                              ? <span className="font-medium text-gray-800">{formatRawScore(hw.finalScore)}</span>
                              : hw.submitted
                                ? <span className="text-blue-600">Submitted</span>
                                : <span className="text-red-500">Missing</span>
                            }
                          </div>
                        </div>
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentFilePanel({ data, role }: { data: StudentFileData; role: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)
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
          {(student.attendancePercentage != null || student.behaviourPositive != null || student.hasExclusion) && (
            <SectionCard title="MIS data · via Wonde">
              <div className="space-y-2">
                {student.attendancePercentage != null && (() => {
                  const pct = student.attendancePercentage!
                  const cls = pct >= 95 ? 'text-green-700' : pct >= 90 ? 'text-amber-700' : 'text-red-700'
                  return (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Attendance this term</span>
                      <span className={`font-semibold ${cls}`}>{pct.toFixed(1)}%</span>
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
          {!data.kPlan && !data.ilp && !data.ehcp && (
            <p className="text-sm text-gray-400 text-center py-8">No SEND documents on file for this student.</p>
          )}
          {data.kPlan && (
            <SectionCard title="K Plan (Learning Passport)" action={<StatusBadge status={data.kPlan.status} />}>
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

      {/* ── Tab: Homework ── */}
      {activeTab === 'Homework' && (
        <PerformanceTab data={data} studentName={studentName} />
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
