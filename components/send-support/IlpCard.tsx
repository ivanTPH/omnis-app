'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import type { IlpWithTargets, IlpAuditEntryRow } from '@/app/actions/send-support'
import {
  updateIlpTarget, approveGeneratedIlp, getIlpAuditLog, updateSendStatus,
  updateIlpDraft, updateIlpTargetText,
  approveAPDR, updateAPDRSection, completeAPDRReview, generateAPDRForStudent,
} from '@/app/actions/send-support'

const ROLE_LABELS: Record<string, string> = {
  SENCO: 'SENCO', TEACHER: 'Teacher', HEAD_OF_DEPT: 'HoD',
  HEAD_OF_YEAR: 'HoY', SLT: 'SLT', SCHOOL_ADMIN: 'Admin',
}

const TARGET_STATUS_ICONS: Record<string, React.ReactNode> = {
  active:       <Icon name="schedule" size="sm" className="text-blue-500" />,
  achieved:     <Icon name="check_circle" size="sm" className="text-green-500" />,
  not_achieved: <Icon name="cancel" size="sm" className="text-red-500" />,
  deferred:     <Icon name="expand_more" size="sm" className="text-orange-500" />,
}

// APDR (Assess → Plan → Do → Review) cycle derived from ILP status
const APDR_STEPS = ['Assess', 'Plan', 'Do', 'Review'] as const

function apdrStepIndex(status: string): number {
  if (status === 'draft')        return 1  // Plan phase
  if (status === 'active')       return 2  // Do phase
  if (status === 'under_review') return 3  // Review phase
  if (status === 'archived')     return 4  // All complete
  return 1
}

type Props = { ilp: IlpWithTargets; userRole?: string }

export default function IlpCard({ ilp, userRole = 'SENCO' }: Props) {
  const [updatingId,       setUpdatingId]       = useState<string | null>(null)
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null)
  const [notes,            setNotes]            = useState('')
  const [deferredDate,     setDeferredDate]     = useState('')
  const [pendingStatus,    setPendingStatus]    = useState('')
  const [approving,        setApproving]        = useState(false)
  const [approved,         setApproved]         = useState(false)
  const [auditOpen,        setAuditOpen]        = useState(false)
  const [auditEntries,     setAuditEntries]     = useState<IlpAuditEntryRow[] | null>(null)
  const [auditLoading,     setAuditLoading]     = useState(false)
  const [sendStatus,       setSendStatus]       = useState(ilp.sendStatus ?? 'NONE')
  const [statusUpdating,   setStatusUpdating]   = useState(false)
  const [statusToast,      setStatusToast]      = useState<string | null>(null)

  // Edit-before-approve state (for under_review ILPs)
  const [editMode,         setEditMode]         = useState(false)
  const [draftStrengths,   setDraftStrengths]   = useState(ilp.currentStrengths)
  const [draftNeeds,       setDraftNeeds]       = useState(ilp.areasOfNeed)
  const [draftCriteria,    setDraftCriteria]    = useState(ilp.successCriteria)
  const [savingDraft,      setSavingDraft]      = useState(false)

  // Inline target text editing (works on both draft and approved ILPs)
  const [editingTarget,    setEditingTarget]    = useState<{ id: string; field: 'target' | 'strategy' | 'successMeasure'; value: string } | null>(null)
  const [savingTargetText, setSavingTargetText] = useState(false)

  // APDR cycle panel
  const isSencoTier = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(userRole)
  const [apdrOpen,        setApdrOpen]        = useState(false)
  const [doContent,       setDoContent]       = useState(ilp.activeApdrCycle?.doContent ?? '')
  const [doEditing,       setDoEditing]       = useState(false)
  const [apdrReviewOpen,  setApdrReviewOpen]  = useState(false)
  const [apdrReviewDraft, setApdrReviewDraft] = useState(ilp.activeApdrCycle?.reviewContent ?? '')
  const [apdrApproved,    setApdrApproved]    = useState(ilp.activeApdrCycle?.approvedBySenco ?? false)
  const [doSaving,        startDoTransition]  = useTransition()
  const [apdrApproving,   startApproveApdrTransition] = useTransition()
  const [apdrCompleting,  startCompleteApdrTransition] = useTransition()
  const [apdrGenerating,  startGenerateApdrTransition] = useTransition()

  function handleSaveDo() {
    if (!ilp.activeApdrCycle) return
    startDoTransition(async () => {
      await updateAPDRSection(ilp.activeApdrCycle!.id, 'doContent', doContent)
      setDoEditing(false)
    })
  }

  function handleApproveApdr() {
    if (!ilp.activeApdrCycle) return
    startApproveApdrTransition(async () => {
      await approveAPDR(ilp.activeApdrCycle!.id)
      setApdrApproved(true)
    })
  }

  function handleCompleteApdrReview() {
    if (!ilp.activeApdrCycle) return
    startCompleteApdrTransition(async () => {
      await completeAPDRReview(ilp.activeApdrCycle!.id, apdrReviewDraft, '', '')
      setApdrReviewOpen(false)
    })
  }

  function handleGenerateApdr() {
    startGenerateApdrTransition(async () => {
      await generateAPDRForStudent(ilp.studentId)
    })
  }

  async function handleToggleAudit() {
    if (!auditOpen && auditEntries === null) {
      setAuditLoading(true)
      try {
        const entries = await getIlpAuditLog(ilp.id)
        setAuditEntries(entries)
      } finally {
        setAuditLoading(false)
      }
    }
    setAuditOpen(prev => !prev)
  }

  async function handleApprove() {
    setApproving(true)
    try {
      await approveGeneratedIlp(ilp.id)
      setApproved(true)
      toast('ILP approved and activated')
    } catch {
      toast('Failed to approve ILP', 'error')
    } finally {
      setApproving(false)
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    try {
      await updateIlpDraft(ilp.id, {
        currentStrengths: draftStrengths,
        areasOfNeed:      draftNeeds,
        successCriteria:  draftCriteria,
      })
      setEditMode(false)
      toast('ILP saved')
    } catch {
      toast('Failed to save ILP', 'error')
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSaveTargetText() {
    if (!editingTarget) return
    setSavingTargetText(true)
    try {
      await updateIlpTargetText(editingTarget.id, editingTarget.field, editingTarget.value)
      // Refresh audit log if open
      if (auditOpen) {
        const entries = await getIlpAuditLog(ilp.id)
        setAuditEntries(entries)
      }
      setEditingTarget(null)
      toast('Target saved')
    } catch {
      toast('Failed to save target', 'error')
    } finally {
      setSavingTargetText(false)
    }
  }

  async function handleSendStatusChange(newStatus: 'NONE' | 'SEN_SUPPORT' | 'EHCP') {
    if (newStatus === sendStatus) return
    setStatusUpdating(true)
    try {
      await updateSendStatus(ilp.studentId, newStatus)
      setSendStatus(newStatus)
      const label = newStatus === 'NONE' ? 'No SEND' : newStatus === 'SEN_SUPPORT' ? 'SEN Support' : 'EHCP'
      setStatusToast(`SEND status updated to ${label}`)
      setTimeout(() => setStatusToast(null), 3000)
    } catch {
      setStatusToast('Failed to update SEND status')
      setTimeout(() => setStatusToast(null), 3000)
    } finally {
      setStatusUpdating(false)
    }
  }

  async function saveTargetUpdate(targetId: string) {
    setUpdatingId(targetId)
    try {
      const nd = pendingStatus === 'deferred' && deferredDate ? new Date(deferredDate) : undefined
      await updateIlpTarget(targetId, pendingStatus, notes, nd)
      toast('Target status updated')
    } catch {
      toast('Failed to update target', 'error')
    } finally {
      setUpdatingId(null)
      setExpandedTargetId(null)
      setNotes('')
      setPendingStatus('')
      setDeferredDate('')
    }
  }

  const reviewSoon = new Date(ilp.reviewDate).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000

  // All targets resolved — prompt SENCO to start the next APDR cycle
  const TERMINAL = new Set(['achieved', 'not_achieved', 'deferred'])
  const allTargetsTerminal = ilp.targets.length > 0 && ilp.targets.every(t => TERMINAL.has(t.status))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Toast */}
      {statusToast && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-medium">
          {statusToast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="favorite_border" size="sm" className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Individual Learning Plan</h3>
              {ilp.autoGenerated && (
                <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  <Icon name="auto_awesome" size="sm" /> AI-generated
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {ilp.studentName} · {ilp.sendCategory}
            </p>
            {/* SEND status dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">SEND Status</label>
              <div className="relative flex items-center gap-1.5">
                <select
                  value={sendStatus}
                  onChange={e => handleSendStatusChange(e.target.value as 'NONE' | 'SEN_SUPPORT' | 'EHCP')}
                  disabled={statusUpdating}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 pr-6 bg-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="NONE">No SEND</option>
                  <option value="SEN_SUPPORT">SEN Support</option>
                  <option value="EHCP">EHCP</option>
                </select>
                {statusUpdating && <Icon name="refresh" size="sm" className="animate-spin text-blue-500 shrink-0" />}
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className={`text-xs font-medium ${reviewSoon ? 'text-orange-600' : 'text-gray-500'}`}>
              Review: {new Date(ilp.reviewDate).toLocaleDateString('en-GB')}
            </p>
            {reviewSoon && <p className="text-xs text-orange-500">Review due soon</p>}
            {ilp.status === 'under_review' && !approved && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700 disabled:opacity-50 ml-auto"
              >
                <Icon name="verified_user" size="sm" />
                {approving ? 'Approving…' : 'Approve ILP'}
              </button>
            )}
            {approved && (
              <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-auto">
                <Icon name="check_circle" size="sm" /> Approved
              </span>
            )}
          </div>
        </div>

        {/* APDR Cycle indicator */}
        <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">APDR Cycle</span>
          <div className="flex items-center">
            {APDR_STEPS.map((label, i) => {
              const current = apdrStepIndex(ilp.status)
              const isCompleted = i < current
              const isCurrent = i === current
              return (
                <div key={label} className="flex items-center">
                  {i > 0 && (
                    <div className={`h-px w-5 ${isCompleted ? 'bg-green-400' : isCurrent ? 'bg-blue-300' : 'bg-gray-200'}`} />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                      ${isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-200' : 'bg-gray-200 text-gray-400'}`}>
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    <span className={`text-[9px] font-semibold whitespace-nowrap
                      ${isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-700' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <span className="ml-1 text-[10px] text-gray-500 italic">
            {ilp.status === 'draft'        ? 'Targets being planned'       :
             ilp.status === 'active'       ? 'Interventions in progress'   :
             ilp.status === 'under_review' ? 'Ready for SENCO review'      :
             ilp.status === 'archived'     ? 'Cycle complete'              : ''}
          </span>
          <button
            onClick={() => setApdrOpen(v => !v)}
            className="ml-auto flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 shrink-0"
          >
            <Icon name="loop" size="sm" />
            {ilp.activeApdrCycle ? `Cycle ${ilp.activeApdrCycle.cycleNumber}` : 'APDR'}
            <Icon name={apdrOpen ? 'expand_less' : 'expand_more'} size="sm" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* ── APDR cycle panel (expandable) ─────────────────────────────────── */}
        {apdrOpen && (
          <div className="rounded-xl border border-indigo-200 overflow-hidden bg-indigo-50/40">
            {ilp.activeApdrCycle ? (
              <>
                {/* Assess + Plan — read-only snippets */}
                <div className="px-4 py-3 grid sm:grid-cols-2 gap-4 border-b border-indigo-100">
                  {(['assessContent', 'planContent'] as const).map(field => (
                    <div key={field}>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
                        {field === 'assessContent' ? 'Assess' : 'Plan'}
                      </p>
                      {ilp.activeApdrCycle![field] ? (
                        <p className="text-xs text-gray-700 line-clamp-4 whitespace-pre-wrap">
                          {ilp.activeApdrCycle![field]}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Not yet completed</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Do — editable by all staff */}
                <div className="px-4 py-3 border-b border-indigo-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Do — Observations</p>
                    {!doEditing && (
                      <button
                        onClick={() => { setDoContent(ilp.activeApdrCycle!.doContent); setDoEditing(true) }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Icon name="edit" size="sm" />Add note
                      </button>
                    )}
                  </div>
                  {doEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={doContent}
                        onChange={e => setDoContent(e.target.value)}
                        rows={3}
                        placeholder="Observations this cycle — what is working, what needs adjustment."
                        className="w-full text-xs border border-indigo-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveDo}
                          disabled={doSaving}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                        >
                          {doSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setDoEditing(false)} className="text-xs text-gray-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">
                      {doContent || <span className="text-gray-400 italic">No observations yet — click &ldquo;Add note&rdquo; to record what&apos;s working.</span>}
                    </p>
                  )}
                </div>

                {/* Review — SENCO-only complete form */}
                {isSencoTier && (
                  <div className="px-4 py-3 border-b border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">Review</p>
                    {apdrReviewOpen ? (
                      <div className="space-y-2">
                        <textarea
                          value={apdrReviewDraft}
                          onChange={e => setApdrReviewDraft(e.target.value)}
                          rows={3}
                          placeholder="Summarise impact of this cycle and recommendations for the next cycle…"
                          className="w-full text-xs border border-blue-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCompleteApdrReview}
                            disabled={apdrCompleting}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            <Icon name="done_all" size="sm" />
                            {apdrCompleting ? 'Completing…' : 'Complete + start next cycle'}
                          </button>
                          <button onClick={() => setApdrReviewOpen(false)} className="text-xs text-gray-500">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 italic">
                          {ilp.activeApdrCycle.reviewContent || 'Write review to close this cycle and auto-start the next.'}
                        </p>
                        <button
                          onClick={() => setApdrReviewOpen(true)}
                          className="ml-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
                        >
                          <Icon name="rate_review" size="sm" />Write review
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer actions */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap bg-white/60">
                  <div className="flex items-center gap-2">
                    {isSencoTier && !apdrApproved && (
                      <button
                        onClick={handleApproveApdr}
                        disabled={apdrApproving}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        <Icon name="verified" size="sm" />
                        {apdrApproving ? 'Approving…' : 'Approve cycle'}
                      </button>
                    )}
                    {apdrApproved && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Icon name="verified" size="sm" />Approved
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      Review due {new Date(ilp.activeApdrCycle.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <Link
                    href={`/students/${ilp.studentId}?tab=APDR`}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                  >
                    Full APDR <Icon name="open_in_new" size="sm" />
                  </Link>
                </div>
              </>
            ) : (
              /* No active cycle — SENCO can generate one */
              <div className="px-4 py-6 text-center">
                <Icon name="loop" size="lg" color="#a5b4fc" />
                <p className="text-xs text-gray-500 mt-2 mb-3">No active APDR cycle on file.</p>
                {isSencoTier && (
                  <button
                    onClick={handleGenerateApdr}
                    disabled={apdrGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    <Icon name={apdrGenerating ? 'refresh' : 'auto_awesome'} size="sm" className={apdrGenerating ? 'animate-spin' : ''} />
                    {apdrGenerating ? 'Generating…' : 'Generate APDR from ILP'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit mode toggle for draft ILPs */}
        {ilp.status === 'under_review' && !approved && (
          <div className="flex items-center justify-between pb-1 border-b border-amber-100">
            <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
              <Icon name="edit_note" size="sm" /> Review &amp; edit before approving
            </span>
            <button
              onClick={() => setEditMode(v => !v)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${editMode ? 'bg-amber-100 border-amber-300 text-amber-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {editMode ? 'Exit edit mode' : 'Edit fields'}
            </button>
          </div>
        )}

        {/* Strengths & Needs */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Current Strengths</p>
            {editMode ? (
              <textarea
                value={draftStrengths}
                onChange={e => setDraftStrengths(e.target.value)}
                rows={3}
                className="w-full border border-green-300 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            ) : (
              <p className="text-sm text-gray-700">{ilp.currentStrengths}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Areas of Need</p>
            {editMode ? (
              <textarea
                value={draftNeeds}
                onChange={e => setDraftNeeds(e.target.value)}
                rows={3}
                className="w-full border border-amber-300 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            ) : (
              <p className="text-sm text-gray-700">{ilp.areasOfNeed}</p>
            )}
          </div>
        </div>

        {/* Targets */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Targets</p>
          <div className="space-y-2">
            {ilp.targets.map(t => (
              <div key={t.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  {TARGET_STATUS_ICONS[t.status] ?? <Icon name="track_changes" size="sm" className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    {editingTarget?.id === t.id && editingTarget.field === 'target' ? (
                      <div className="flex items-start gap-2 mb-1">
                        <textarea
                          value={editingTarget.value}
                          onChange={e => setEditingTarget(et => et && ({ ...et, value: e.target.value }))}
                          rows={2}
                          autoFocus
                          className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button onClick={handleSaveTargetText} disabled={savingTargetText} className="shrink-0 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                          {savingTargetText ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingTarget(null)} className="shrink-0 text-xs px-2 py-1 border border-gray-200 rounded-lg">×</button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1 mb-0.5 group">
                        <p className="text-sm font-medium text-gray-900 flex-1">{t.target}</p>
                        <button
                          onClick={() => setEditingTarget({ id: t.id, field: 'target', value: t.target })}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
                          title="Edit SMART target"
                        >
                          <Icon name="edit" size="sm" className="text-gray-400" />
                        </button>
                      </div>
                    )}
                    {editingTarget?.id === t.id && editingTarget.field === 'strategy' ? (
                      <div className="flex items-start gap-2 mb-1">
                        <textarea
                          value={editingTarget.value}
                          onChange={e => setEditingTarget(et => et && ({ ...et, value: e.target.value }))}
                          rows={2}
                          autoFocus
                          className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button onClick={handleSaveTargetText} disabled={savingTargetText} className="shrink-0 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                          {savingTargetText ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingTarget(null)} className="shrink-0 text-xs px-2 py-1 border border-gray-200 rounded-lg">×</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group">
                        <p className="text-xs text-gray-500 mt-0.5 flex-1">Strategy: {t.strategy}</p>
                        <button
                          onClick={() => setEditingTarget({ id: t.id, field: 'strategy', value: t.strategy })}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
                          title="Edit strategy"
                        >
                          <Icon name="edit" size="sm" className="text-gray-400" />
                        </button>
                      </div>
                    )}
                    {editingTarget?.id === t.id && editingTarget.field === 'successMeasure' ? (
                      <div className="flex items-start gap-2 mb-1">
                        <textarea
                          value={editingTarget.value}
                          onChange={e => setEditingTarget(et => et && ({ ...et, value: e.target.value }))}
                          rows={2}
                          autoFocus
                          className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button onClick={handleSaveTargetText} disabled={savingTargetText} className="shrink-0 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                          {savingTargetText ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingTarget(null)} className="shrink-0 text-xs px-2 py-1 border border-gray-200 rounded-lg">×</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group">
                        <p className="text-xs text-gray-500 flex-1">Success measure: {t.successMeasure}</p>
                        <button
                          onClick={() => setEditingTarget({ id: t.id, field: 'successMeasure', value: t.successMeasure })}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
                          title="Edit success measure"
                        >
                          <Icon name="edit" size="sm" className="text-gray-400" />
                        </button>
                      </div>
                    )}
                    {t.progressNotes && (
                      <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mt-1">{t.progressNotes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Target date: {new Date(t.targetDate).toLocaleDateString('en-GB')}</p>
                  </div>
                  <button
                    onClick={() => setExpandedTargetId(expandedTargetId === t.id ? null : t.id)}
                    className="shrink-0 text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Update
                  </button>
                </div>

                {expandedTargetId === t.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <select
                      value={pendingStatus || t.status}
                      onChange={e => setPendingStatus(e.target.value)}
                      disabled={updatingId === t.id}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="achieved">Achieved</option>
                      <option value="not_achieved">Not Achieved</option>
                      <option value="deferred">Deferred</option>
                    </select>
                    {(pendingStatus || t.status) === 'deferred' && (
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">New target date</label>
                        <input
                          type="date"
                          value={deferredDate}
                          onChange={e => setDeferredDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                    )}
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Progress notes (optional)…"
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveTargetUpdate(t.id)}
                        disabled={updatingId === t.id || !(pendingStatus || t.status)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        {updatingId === t.id
                          ? <><Icon name="refresh" size="sm" className="animate-spin" /> Saving…</>
                          : <><Icon name="check" size="sm" /> Save review</>
                        }
                      </button>
                      <button
                        onClick={() => { setExpandedTargetId(null); setPendingStatus(''); setNotes(''); setDeferredDate('') }}
                        className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-500"
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

        {/* Re-plan prompt — shown when all targets are in a terminal state */}
        {allTargetsTerminal && isSencoTier && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-indigo-800">All targets reviewed</p>
              <p className="text-xs text-indigo-600 mt-0.5">Ready to start the next APDR cycle with new targets.</p>
            </div>
            <button
              onClick={handleGenerateApdr}
              disabled={apdrGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0"
            >
              <Icon name={apdrGenerating ? 'refresh' : 'loop'} size="sm" className={apdrGenerating ? 'animate-spin' : ''} />
              {apdrGenerating ? 'Generating…' : 'Start new APDR cycle'}
            </button>
          </div>
        )}

        {/* Strategies */}
        {ilp.strategies.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Teaching Strategies</p>
            <ul className="space-y-1">
              {ilp.strategies.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-400 mt-0.5">·</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI-generated: likes / dislikes */}
        {(ilp.likes || ilp.dislikes) && (
          <div className="grid md:grid-cols-2 gap-4">
            {ilp.likes && (
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Icon name="thumb_up" size="sm" /> What the student enjoys
                </p>
                <p className="text-sm text-gray-700">{ilp.likes}</p>
              </div>
            )}
            {ilp.dislikes && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Icon name="thumb_down" size="sm" /> Common challenges
                </p>
                <p className="text-sm text-gray-700">{ilp.dislikes}</p>
              </div>
            )}
          </div>
        )}

        {/* AI-generated: resources needed */}
        {ilp.resourcesNeeded && ilp.resourcesNeeded.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Icon name="inventory_2" size="sm" /> Resources Needed
            </p>
            <ul className="space-y-1">
              {ilp.resourcesNeeded.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-purple-400 mt-0.5">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success criteria */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Success Criteria</p>
          {editMode ? (
            <textarea
              value={draftCriteria}
              onChange={e => setDraftCriteria(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <p className="text-sm text-gray-700">{ilp.successCriteria}</p>
          )}
        </div>

        {/* Save draft button — only shown in edit mode */}
        {editMode && (
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setEditMode(false)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingDraft ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="save" size="sm" />}
              Save changes
            </button>
          </div>
        )}

        {/* Audit trail — only visible once ILP is approved */}
        {ilp.approvedBySenco && (
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={handleToggleAudit}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              <Icon name="history" size="sm" />
              {auditOpen ? 'Hide' : 'Show'} edit history
              <Icon name="chevron_right" size="sm" className={`transition-transform ${auditOpen ? 'rotate-90' : ''}`} />
            </button>

            {auditOpen && (
              <div className="mt-3">
                {auditLoading ? (
                  <p className="text-xs text-gray-400 animate-pulse">Loading…</p>
                ) : !auditEntries || auditEntries.length === 0 ? (
                  <p className="text-xs text-gray-400">No edits recorded yet.</p>
                ) : (
                  <ol className="relative border-l border-gray-200 space-y-4 pl-4">
                    {auditEntries.map(entry => (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[1.15rem] top-1 w-2 h-2 rounded-full bg-blue-400 border-2 border-white" />
                        <p className="text-xs font-medium text-gray-800">
                          {entry.userName}
                          <span className="font-normal text-gray-500">
                            {' '}({ROLE_LABELS[entry.userRole] ?? entry.userRole})
                          </span>
                          {' '}edited <span className="font-medium">{entry.fieldChanged}</span>
                          {' '}on {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {entry.previousValue || entry.newValue ? (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {entry.changeType === 'ADDED' ? (
                              <>Added: <span className="text-green-700">&ldquo;{entry.newValue}&rdquo;</span></>
                            ) : entry.changeType === 'DELETED' ? (
                              <>Removed: <span className="text-red-600 line-through">&ldquo;{entry.previousValue}&rdquo;</span></>
                            ) : (
                              <>&ldquo;{entry.previousValue}&rdquo; → &ldquo;{entry.newValue}&rdquo;</>
                            )}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
