'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { IlpWithTargets, IlpAuditEntryRow } from '@/app/actions/send-support'
import { updateIlpTarget, approveGeneratedIlp, getIlpAuditLog, updateSendStatus, updateIlpDraft, updateIlpTargetText } from '@/app/actions/send-support'

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

type Props = { ilp: IlpWithTargets }

export default function IlpCard({ ilp }: Props) {
  const [updatingId,       setUpdatingId]       = useState<string | null>(null)
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null)
  const [notes,            setNotes]            = useState('')
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
    } catch (err) {
      console.error('[IlpCard] draft save failed:', err)
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
    } catch (err) {
      console.error('[IlpCard] target text save failed:', err)
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

  async function saveTargetUpdate(targetId: string, status: string) {
    setUpdatingId(targetId)
    try {
      await updateIlpTarget(targetId, status, notes)
    } finally {
      setUpdatingId(null)
      setExpandedTargetId(null)
      setNotes('')
    }
  }

  const reviewSoon = new Date(ilp.reviewDate).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000

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
      </div>

      <div className="p-5 space-y-5">
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
                      defaultValue={t.status}
                      onChange={e => saveTargetUpdate(t.id, e.target.value)}
                      disabled={updatingId === t.id}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="achieved">Achieved</option>
                      <option value="not_achieved">Not Achieved</option>
                      <option value="deferred">Deferred</option>
                    </select>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Progress notes (optional)…"
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

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
