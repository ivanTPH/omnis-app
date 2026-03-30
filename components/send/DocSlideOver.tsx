'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { getStudentIlp, getStudentLearnerPassport, getIlpAuditLog, type IlpWithTargets, type LearnerPassportRow, type IlpAuditEntryRow } from '@/app/actions/send-support'
import { getStudentEhcp, getEhcpAuditLog, type EhcpPlanWithOutcomes, type EhcpAuditEntryRow } from '@/app/actions/ehcp'
import { addRosterNote } from '@/app/actions/lessons'

export type DocSlideOverDocType = 'ilp' | 'ehcp' | 'kplan'

interface DocSlideOverProps {
  studentId:   string
  studentName: string
  docType:     DocSlideOverDocType
  onClose:     () => void
}

const DOC_META: Record<DocSlideOverDocType, { label: string; iconName: string; headerCls: string; badgeCls: string }> = {
  ilp:   { label: 'Individual Learning Plan',   iconName: 'favorite_border', headerCls: 'bg-blue-700',   badgeCls: 'bg-blue-100 text-blue-700' },
  ehcp:  { label: 'EHCP Plan',                  iconName: 'verified_user',   headerCls: 'bg-purple-800', badgeCls: 'bg-purple-100 text-purple-700' },
  kplan: { label: 'K Plan — Learning Passport',  iconName: 'menu_book',       headerCls: 'bg-teal-700',   badgeCls: 'bg-teal-100 text-teal-700' },
}

const TARGET_STATUS_CLS: Record<string, string> = {
  active:       'bg-blue-100 text-blue-700',
  achieved:     'bg-green-100 text-green-700',
  not_achieved: 'bg-red-100 text-red-700',
  deferred:     'bg-orange-100 text-orange-700',
}

const SECTION_LABELS: Record<string, string> = {
  A: 'Section A — Views, interests and aspirations',
  B: 'Section B — Special educational needs',
  C: 'Section C — Health needs',
  D: 'Section D — Social care needs',
  E: 'Section E — Outcomes',
  F: 'Section F — Special educational provision',
  G: 'Section G — Health provision',
  H: 'Section H — Social care provision',
  I: 'Section I — Educational placement',
  J: 'Section J — Personal budget',
  K: 'Section K — Appendices',
}

export default function DocSlideOver({ studentId, studentName, docType, onClose }: DocSlideOverProps) {
  const meta = DOC_META[docType]

  const [ilp,         setIlp]         = useState<IlpWithTargets | null>(null)
  const [ehcp,        setEhcp]        = useState<EhcpPlanWithOutcomes | null>(null)
  const [kplan,       setKplan]       = useState<LearnerPassportRow | null>(null)
  const [loading,     setLoading]     = useState(true)

  const [auditOpen,    setAuditOpen]    = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [ilpAudit,    setIlpAudit]    = useState<IlpAuditEntryRow[] | null>(null)
  const [ehcpAudit,   setEhcpAudit]   = useState<EhcpAuditEntryRow[] | null>(null)

  const [noteText,    setNoteText]    = useState('')
  const [noteSaving,  setNoteSaving]  = useState(false)
  const [noteSaved,   setNoteSaved]   = useState(false)

  useEffect(() => {
    setLoading(true)
    if (docType === 'ilp') {
      getStudentIlp(studentId)
        .then(d => setIlp(d))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (docType === 'ehcp') {
      getStudentEhcp(studentId)
        .then(d => setEhcp(d))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      getStudentLearnerPassport(studentId)
        .then(d => setKplan(d))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [studentId, docType])

  useEffect(() => {
    if (!auditOpen) return
    if (docType === 'ilp' && ilp && !ilpAudit) {
      setAuditLoading(true)
      getIlpAuditLog(ilp.id)
        .then(setIlpAudit)
        .catch(() => setIlpAudit([]))
        .finally(() => setAuditLoading(false))
    } else if (docType === 'ehcp' && ehcp && !ehcpAudit) {
      setAuditLoading(true)
      getEhcpAuditLog(ehcp.id)
        .then(setEhcpAudit)
        .catch(() => setEhcpAudit([]))
        .finally(() => setAuditLoading(false))
    }
  }, [auditOpen, docType, ilp, ehcp, ilpAudit, ehcpAudit])

  async function handleSaveNote() {
    const trimmed = noteText.trim()
    if (!trimmed) return
    setNoteSaving(true)
    try {
      await addRosterNote(studentId, trimmed)
      setNoteText('')
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    } finally {
      setNoteSaving(false)
    }
  }

  // Status badge
  function statusBadge(status: string) {
    const map: Record<string, string> = {
      active:       'bg-green-100 text-green-700',
      under_review: 'bg-amber-100 text-amber-700',
      draft:        'bg-gray-100 text-gray-500',
      approved:     'bg-green-100 text-green-700',
      archived:     'bg-gray-100 text-gray-400',
    }
    const cls = map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-500'
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  const supportsAudit = docType === 'ilp' || docType === 'ehcp'
  const auditEntries  = docType === 'ilp' ? ilpAudit : ehcpAudit

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel — slides in from right */}
      <div className="w-[520px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 text-white shrink-0 ${meta.headerCls}`}>
          <span className={`p-1.5 rounded-lg ${meta.badgeCls}`}>
            <Icon name={meta.iconName} size="sm" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-0.5">
              {meta.label}
            </p>
            <h2 className="text-[15px] font-bold truncate">{studentName}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!loading && (docType === 'ilp' ? ilp : docType === 'ehcp' ? ehcp : kplan) && (
              statusBadge(
                docType === 'ilp'   ? (ilp?.status ?? 'draft') :
                docType === 'ehcp'  ? (ehcp?.status ?? 'draft') :
                                      (kplan?.status ?? 'draft'),
              )
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <Icon name="close" size="sm" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Icon name="refresh" size="md" className="animate-spin text-gray-400" />
            </div>
          )}

          {/* ILP */}
          {!loading && docType === 'ilp' && (
            ilp ? (
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Current Strengths</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{ilp.currentStrengths}</p>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Areas of Need</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{ilp.areasOfNeed}</p>
                </section>

                {ilp.strategies.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Strategies</p>
                    <ul className="space-y-1">
                      {ilp.strategies.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {ilp.successCriteria && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-1">Success Criteria</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed">{ilp.successCriteria}</p>
                  </section>
                )}

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">SMART Goals</p>
                  {ilp.targets.length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No active targets.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {ilp.targets.map((t, i) => (
                        <div key={t.id} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-gray-900">{i + 1}. {t.target}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TARGET_STATUS_CLS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {t.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">Strategy: {t.strategy}</p>
                          <p className="text-[11px] text-gray-500">Success: {t.successMeasure}</p>
                          <p className="text-[10px] text-gray-400">
                            Due {new Date(t.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <p className="text-[13px] text-gray-400 italic">No active ILP found for this student.</p>
            )
          )}

          {/* EHCP */}
          {!loading && docType === 'ehcp' && (
            ehcp ? (
              <>
                <section className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Local Authority</p>
                    <p className="text-[13px] text-gray-800">{ehcp.localAuthority}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Annual Review</p>
                    <p className="text-[13px] text-gray-800">
                      {new Date(ehcp.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  {ehcp.coordinatorName && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">SEND Coordinator</p>
                      <p className="text-[13px] text-gray-800">{ehcp.coordinatorName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Plan Date</p>
                    <p className="text-[13px] text-gray-800">
                      {new Date(ehcp.planDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </section>

                {/* Sections — only render those with content */}
                {ehcp.sections && Object.entries(ehcp.sections).map(([key, value]) => {
                  if (!value || typeof value !== 'string') return null
                  const sectionLabel = SECTION_LABELS[key.toUpperCase()] ?? `Section ${key.toUpperCase()}`
                  return (
                    <section key={key}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">{sectionLabel}</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{value}</p>
                    </section>
                  )
                })}

                {ehcp.outcomes.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">Outcomes</p>
                    <div className="space-y-2.5">
                      {ehcp.outcomes.map((o, i) => (
                        <div key={o.id} className="border border-purple-100 rounded-xl px-4 py-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-gray-900">{i + 1}. {o.outcomeText}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TARGET_STATUS_CLS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {o.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {o.successCriteria && (
                            <p className="text-[11px] text-gray-500">Success: {o.successCriteria}</p>
                          )}
                          {o.provisionRequired && (
                            <p className="text-[11px] text-purple-600">Provision: {o.provisionRequired}</p>
                          )}
                          <p className="text-[10px] text-gray-400">
                            Target {new Date(o.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {o.evidenceCount > 0 && ` · ${o.evidenceCount} evidence item${o.evidenceCount !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <p className="text-[13px] text-gray-400 italic">No active EHCP found for this student.</p>
            )
          )}

          {/* K Plan */}
          {!loading && docType === 'kplan' && (
            kplan ? (
              <>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">SEND Information</p>
                  <div className="border-l-4 border-amber-400 pl-4">
                    <p className="text-[13px] text-amber-900 italic leading-relaxed whitespace-pre-wrap">
                      {kplan.sendInformation}
                    </p>
                  </div>
                </section>

                {kplan.teacherActions.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">
                      It would help me if you could
                    </p>
                    <ol className="space-y-2">
                      {kplan.teacherActions.map((action, i) => (
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

                {kplan.studentCommitments.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-2">
                      I will help myself by
                    </p>
                    <ul className="space-y-1.5">
                      {kplan.studentCommitments.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="text-[12px] text-gray-500 space-y-1">
                  {kplan.approvedBy && (
                    <p>Approved by: <span className="text-gray-700 font-medium">{kplan.approvedBy}</span></p>
                  )}
                  {kplan.approvedAt && (
                    <p>
                      Approved: {new Date(kplan.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </section>

                <section>
                  <p className="text-[11px] text-gray-400 italic">
                    No formal amendment log for K Plan — use the notes section below to add classroom observations.
                  </p>
                </section>
              </>
            ) : (
              <p className="text-[13px] text-gray-400 italic">No K Plan found for this student.</p>
            )
          )}

          {/* Audit trail */}
          {!loading && supportsAudit && (
            <section className="border-t border-gray-100 pt-4">
              <button
                onClick={() => setAuditOpen(o => !o)}
                className="flex items-center gap-2 text-[12px] text-gray-500 hover:text-gray-700 font-medium w-full"
              >
                <Icon name={auditOpen ? 'expand_more' : 'chevron_right'} size="sm" />
                Amendment history
              </button>
              {auditOpen && (
                <div className="mt-3">
                  {auditLoading ? (
                    <p className="text-[11px] text-gray-400 animate-pulse">Loading…</p>
                  ) : !auditEntries || auditEntries.length === 0 ? (
                    <p className="text-[11px] text-gray-400">No amendments recorded yet.</p>
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
                            <p className="text-[11px] font-medium text-gray-700 flex flex-wrap items-center gap-1">
                              {entry.userName}
                              <span className="font-normal text-gray-400"> · {entry.fieldChanged} · </span>
                              {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {isPending && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                              )}
                              {isRejected && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Not approved</span>
                              )}
                            </p>
                            {(entry.previousValue || entry.newValue) && (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                &ldquo;{(entry.newValue ?? entry.previousValue ?? '').slice(0, 100)}&rdquo;
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

          {/* Teacher note */}
          <section className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Add classroom observation</p>
            {noteSaved ? (
              <div className="flex items-center gap-2 text-[12px] text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <Icon name="check_circle" size="sm" /> Note saved.
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Record an observation about this student…"
                  rows={3}
                  className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving || !noteText.trim()}
                  className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  <Icon name="save" size="sm" />
                  {noteSaving ? 'Saving…' : 'Add note'}
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
