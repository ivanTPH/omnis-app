'use client'

import { useState, useEffect } from 'react'
import { X, FileHeart, BookOpen, Shield, ChevronDown, ChevronRight, Clock, CheckCircle, Send } from 'lucide-react'
import type { StudentSendDocuments, IlpAuditEntryRow } from '@/app/actions/send-support'
import { getIlpAuditLog, proposeIlpEdit } from '@/app/actions/send-support'

type DocType = 'kPlan' | 'ilp' | 'ehcp'

type Props = {
  docType:     DocType
  doc:         NonNullable<StudentSendDocuments['kPlan'] | StudentSendDocuments['ilp'] | StudentSendDocuments['ehcp']>
  studentName: string
  studentId:   string
  userRole:    string
  onClose:     () => void
}

const DOC_META: Record<DocType, { label: string; icon: React.ReactNode; colour: string }> = {
  kPlan: { label: 'K Plan — Learning Passport', icon: <BookOpen size={15} />,  colour: 'text-amber-700 bg-amber-100' },
  ilp:   { label: 'Individual Learning Plan',   icon: <FileHeart size={15} />, colour: 'text-blue-700  bg-blue-100' },
  ehcp:  { label: 'EHCP Plan',                  icon: <Shield size={15} />,    colour: 'text-purple-700 bg-purple-100' },
}

const TARGET_STATUS: Record<string, { label: string; cls: string }> = {
  active:       { label: 'Active',        cls: 'bg-blue-100 text-blue-700' },
  achieved:     { label: 'Achieved',      cls: 'bg-green-100 text-green-700' },
  not_achieved: { label: 'Not achieved',  cls: 'bg-red-100 text-red-700' },
  deferred:     { label: 'Deferred',      cls: 'bg-orange-100 text-orange-700' },
}

export default function SendDocumentSlideOver({ docType, doc, studentName, studentId, userRole, onClose }: Props) {
  const meta = DOC_META[docType]

  const [auditOpen,    setAuditOpen]    = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditEntries, setAuditEntries] = useState<IlpAuditEntryRow[] | null>(null)
  const [noteOpen,     setNoteOpen]     = useState(false)
  const [noteText,     setNoteText]     = useState('')
  const [noteLoading,  setNoteLoading]  = useState(false)
  const [noteDone,     setNoteDone]     = useState(false)

  // Only ILP supports audit trail & notes through existing actions
  const supportsAudit = docType === 'ilp'
  const canNote = docType === 'ilp' && ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR'].includes(userRole)

  useEffect(() => {
    if (auditOpen && !auditEntries && supportsAudit && docType === 'ilp') {
      setAuditLoading(true)
      getIlpAuditLog(doc.id)
        .then(setAuditEntries)
        .catch(() => setAuditEntries([]))
        .finally(() => setAuditLoading(false))
    }
  }, [auditOpen, auditEntries, doc.id, supportsAudit, docType])

  async function handleSubmitNote() {
    if (!noteText.trim() || docType !== 'ilp') return
    setNoteLoading(true)
    try {
      await proposeIlpEdit(doc.id, 'note', noteText.trim())
      setNoteDone(true)
      setNoteText('')
      setNoteOpen(false)
    } finally {
      setNoteLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="w-[520px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 text-white shrink-0">
          <span className={`p-1.5 rounded-lg text-sm ${meta.colour}`}>{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
              {meta.label}
            </p>
            <h2 className="text-[15px] font-bold truncate">{studentName}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {('approvedAt' in doc) && doc.approvedAt ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-green-600 rounded-full">
                <CheckCircle size={10} /> Approved {new Date(doc.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-1 bg-amber-500 rounded-full">Draft</span>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* K PLAN */}
          {docType === 'kPlan' && (() => {
            const kPlan = doc as NonNullable<StudentSendDocuments['kPlan']>
            return (
              <>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">SEND Information</p>
                  <div className="border-l-4 border-amber-400 pl-4">
                    <p className="text-[13px] text-amber-900 italic leading-relaxed whitespace-pre-wrap">
                      {kPlan.sendInformation || <span className="text-gray-400">Not yet generated.</span>}
                    </p>
                  </div>
                </section>

                {kPlan.teacherActions.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">
                      It would help me if you could
                    </p>
                    <ol className="space-y-2">
                      {kPlan.teacherActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-700">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          {action}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {kPlan.studentCommitments.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-2">
                      I will help myself by
                    </p>
                    <ul className="space-y-1.5">
                      {kPlan.studentCommitments.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )
          })()}

          {/* ILP */}
          {docType === 'ilp' && (() => {
            const ilp = doc as NonNullable<StudentSendDocuments['ilp']>
            return (
              <>
                <section className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">SEND Category</p>
                    <p className="text-[13px] text-gray-800">{ilp.sendCategory}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Review Date</p>
                    <p className="text-[13px] text-gray-800">
                      {new Date(ilp.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Areas of Need</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{ilp.areasOfNeed}</p>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">SMART Goals</p>
                  {ilp.targets.length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No targets set.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {ilp.targets.map((t, i) => {
                        const ts = TARGET_STATUS[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-600' }
                        return (
                          <div key={t.id} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-medium text-gray-900">{i + 1}. {t.target}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ts.cls}`}>{ts.label}</span>
                            </div>
                            <p className="text-[11px] text-gray-500">Strategy: {t.strategy}</p>
                            <p className="text-[11px] text-gray-500">Success: {t.successMeasure}</p>
                            <p className="text-[10px] text-gray-400">
                              Due {new Date(t.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </>
            )
          })()}

          {/* EHCP */}
          {docType === 'ehcp' && (() => {
            const ehcp = doc as NonNullable<StudentSendDocuments['ehcp']>
            const sectionB = ehcp.sections?.B ?? ehcp.sections?.b
            const sectionF = ehcp.sections?.F ?? ehcp.sections?.f
            const provisions = ehcp.outcomes.filter(o => o.provisionRequired)
            return (
              <>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Annual Review Date</p>
                  <p className="text-[13px] text-gray-800 flex items-center gap-1.5">
                    <Clock size={12} className="text-gray-400" />
                    {new Date(ehcp.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </section>

                {sectionB && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">Section B — Special Educational Needs</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{sectionB}</p>
                  </section>
                )}

                {sectionF && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">Section F — Special Educational Provision</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{sectionF}</p>
                  </section>
                )}

                {provisions.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">Outcomes & Provision</p>
                    <ol className="space-y-2">
                      {provisions.map((o, i) => (
                        <li key={o.id} className="flex items-start gap-2.5 text-[13px] text-gray-700">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <p>{o.outcomeText}</p>
                            {o.provisionRequired && (
                              <p className="text-[11px] text-gray-500 mt-0.5">Provision: {o.provisionRequired}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            )
          })()}

          {/* Audit trail (ILP only) */}
          {supportsAudit && (
            <section className="border-t border-gray-100 pt-4">
              <button
                onClick={() => setAuditOpen(o => !o)}
                className="flex items-center gap-2 text-[12px] text-gray-500 hover:text-gray-700 font-medium w-full"
              >
                {auditOpen
                  ? <ChevronDown size={13} />
                  : <ChevronRight size={13} />}
                Edit history
              </button>
              {auditOpen && (
                <div className="mt-3">
                  {auditLoading ? (
                    <p className="text-[11px] text-gray-400 animate-pulse">Loading…</p>
                  ) : !auditEntries || auditEntries.length === 0 ? (
                    <p className="text-[11px] text-gray-400">No edits recorded yet.</p>
                  ) : (
                    <ol className="border-l border-gray-200 pl-4 space-y-3">
                      {auditEntries.map(entry => {
                        const isPending  = entry.changeType === 'PENDING_EDIT'
                        const isRejected = entry.changeType === 'REJECTED'
                        const dotCls     = isPending  ? 'bg-amber-400'
                                         : isRejected ? 'bg-red-400'
                                         : 'bg-blue-400'
                        return (
                          <li key={entry.id} className="relative">
                            <span className={`absolute -left-[1.2rem] top-1 w-2 h-2 rounded-full border-2 border-white ${dotCls}`} />
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-[11px] font-medium text-gray-700">
                                {entry.userName}
                                <span className="font-normal text-gray-400"> · {entry.fieldChanged} · </span>
                                {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              {isPending && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  Pending review
                                </span>
                              )}
                              {isRejected && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                  Not approved
                                </span>
                              )}
                            </div>
                            {(entry.previousValue || entry.newValue) && (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {entry.changeType === 'ADDED'        && <span className="text-green-600">&ldquo;{entry.newValue}&rdquo;</span>}
                                {entry.changeType === 'DELETED'      && <span className="text-red-500 line-through">&ldquo;{entry.previousValue}&rdquo;</span>}
                                {(entry.changeType === 'EDITED' || isPending || isRejected) && (
                                  <>&ldquo;{(entry.newValue ?? entry.previousValue ?? '').slice(0, 80)}&rdquo;</>
                                )}
                              </p>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Add note — teachers only, ILP only */}
          {canNote && (
            <section className="border-t border-gray-100 pt-4">
              {noteDone ? (
                <div className="flex items-center gap-2 text-[12px] text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle size={13} /> Note submitted — pending SENCO review
                </div>
              ) : noteOpen ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500">Your note will be sent to the SENCO for review before any changes are made.</p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note or suggest a change…"
                    rows={3}
                    className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSubmitNote}
                      disabled={noteLoading || !noteText.trim()}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <Send size={11} /> {noteLoading ? 'Submitting…' : 'Submit note'}
                    </button>
                    <button
                      onClick={() => { setNoteOpen(false); setNoteText('') }}
                      className="text-[12px] text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNoteOpen(true)}
                  className="text-[12px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  + Add note / propose change
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
