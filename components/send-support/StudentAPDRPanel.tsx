'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { ApdrRow, ApdrAuditEntryRow } from '@/app/actions/send-support'
import {
  getStudentAPDRCycles, updateAPDRSection, approveAPDR,
  completeAPDRReview, getAPDRAuditLog, generateAPDRForStudent,
} from '@/app/actions/send-support'

const SECTIONS = [
  { key: 'assessContent', label: 'Assess', colour: 'blue',   desc: 'Information gathered: strengths, observations, learner\'s voice, aspirations' },
  { key: 'planContent',   label: 'Plan',   colour: 'purple', desc: 'Support plan: learning objectives, strategies, TA arrangements' },
  { key: 'doContent',     label: 'Do',     colour: 'green',  desc: 'What support was put in place — updated by teachers/TAs' },
  { key: 'reviewContent', label: 'Review', colour: 'amber',  desc: 'Evaluate effectiveness of this cycle (completed termly)' },
] as const

type SectionKey = typeof SECTIONS[number]['key']

const SENCO_ROLES  = ['SENCO', 'SLT', 'SCHOOL_ADMIN']
const STAFF_ROLES  = [...SENCO_ROLES, 'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']
const COLOUR_MAP: Record<string, Record<string, string>> = {
  blue:   { label: 'bg-blue-100 text-blue-700',   border: 'border-blue-200',   header: 'bg-blue-50' },
  purple: { label: 'bg-purple-100 text-purple-700', border: 'border-purple-200', header: 'bg-purple-50' },
  green:  { label: 'bg-green-100 text-green-700',  border: 'border-green-200',  header: 'bg-green-50' },
  amber:  { label: 'bg-amber-100 text-amber-700',  border: 'border-amber-200',  header: 'bg-amber-50' },
}
const ROLE_LABELS: Record<string, string> = {
  SENCO: 'SENCO', TEACHER: 'Teacher', HEAD_OF_DEPT: 'HoD',
  HEAD_OF_YEAR: 'HoY', SLT: 'SLT', SCHOOL_ADMIN: 'Admin',
}

type Props = { studentId: string; userRole: string }

export default function StudentAPDRPanel({ studentId, userRole }: Props) {
  const [cycles,         setCycles]         = useState<ApdrRow[] | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [editingSection, setEditingSection] = useState<{ apdrId: string; section: SectionKey } | null>(null)
  const [editValue,      setEditValue]      = useState('')
  const [saving,         setSaving]         = useState(false)
  const [approvingId,    setApprovingId]    = useState<string | null>(null)
  const [reviewMode,     setReviewMode]     = useState<string | null>(null) // apdrId
  const [reviewText,     setReviewText]     = useState('')
  const [completing,     setCompleting]     = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [auditOpen,      setAuditOpen]      = useState<string | null>(null)
  const [auditEntries,   setAuditEntries]   = useState<Record<string, ApdrAuditEntryRow[]>>({})
  const [auditLoading,   setAuditLoading]   = useState(false)

  const isSenco = SENCO_ROLES.includes(userRole)
  const isStaff = STAFF_ROLES.includes(userRole)

  useEffect(() => {
    setLoading(true)
    getStudentAPDRCycles(studentId)
      .then(setCycles)
      .catch(() => setCycles([]))
      .finally(() => setLoading(false))
  }, [studentId])

  const activeCycle   = cycles?.find(c => c.status === 'ACTIVE') ?? null
  const completedCycles = cycles?.filter(c => c.status === 'COMPLETED') ?? []

  function startEdit(apdrId: string, section: SectionKey, current: string) {
    setEditingSection({ apdrId, section })
    setEditValue(current)
  }

  async function saveEdit() {
    if (!editingSection) return
    setSaving(true)
    try {
      await updateAPDRSection(editingSection.apdrId, editingSection.section, editValue)
      setCycles(prev => prev?.map(c =>
        c.id === editingSection.apdrId ? { ...c, [editingSection.section]: editValue } : c
      ) ?? null)
      setEditingSection(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(apdrId: string) {
    setApprovingId(apdrId)
    try {
      await approveAPDR(apdrId)
      setCycles(prev => prev?.map(c =>
        c.id === apdrId ? { ...c, approvedBySenco: true, approvedAt: new Date() } : c
      ) ?? null)
    } finally {
      setApprovingId(null)
    }
  }

  async function handleCompleteReview() {
    if (!reviewMode) return
    setCompleting(true)
    try {
      await completeAPDRReview(reviewMode, reviewText)
      // Reload cycles to show new cycle
      const updated = await getStudentAPDRCycles(studentId)
      setCycles(updated)
      setReviewMode(null)
      setReviewText('')
    } finally {
      setCompleting(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generateAPDRForStudent(studentId)
      const updated = await getStudentAPDRCycles(studentId)
      setCycles(updated)
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggleAudit(apdrId: string) {
    if (auditOpen === apdrId) { setAuditOpen(null); return }
    setAuditOpen(apdrId)
    if (!auditEntries[apdrId]) {
      setAuditLoading(true)
      try {
        const entries = await getAPDRAuditLog(apdrId)
        setAuditEntries(prev => ({ ...prev, [apdrId]: entries }))
      } finally {
        setAuditLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="refresh" size="sm" className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isStaff) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">APDR Cycle</p>
          {activeCycle && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              Cycle {activeCycle.cycleNumber} · Review due {new Date(activeCycle.reviewDate).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
        {isSenco && !activeCycle && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-[11px] bg-purple-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {generating ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="auto_awesome" size="sm" />}
            {generating ? 'Generating…' : 'Generate APDR'}
          </button>
        )}
        {isSenco && activeCycle && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-[11px] border border-gray-200 text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Regenerate from ILP"
          >
            <Icon name="refresh" size="sm" /> Regenerate
          </button>
        )}
      </div>

      {/* No APDR yet */}
      {!activeCycle && cycles?.length === 0 && (
        <div className="text-center py-6 text-[12px] text-gray-400">
          No APDR cycle yet.{isSenco ? ' Click Generate to create one.' : ''}
        </div>
      )}

      {/* Active cycle */}
      {activeCycle && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Approval banner */}
          {!activeCycle.approvedBySenco && isSenco && (
            <div className="flex items-center justify-between bg-purple-50 border-b border-purple-100 px-3 py-2">
              <span className="text-[11px] text-purple-700 flex items-center gap-1">
                <Icon name="auto_awesome" size="sm" /> AI draft — review before approving
              </span>
              <button
                onClick={() => handleApprove(activeCycle.id)}
                disabled={approvingId === activeCycle.id}
                className="flex items-center gap-1 text-[11px] bg-green-600 text-white px-2.5 py-1 rounded-full hover:bg-green-700 disabled:opacity-50"
              >
                <Icon name="verified_user" size="sm" />
                {approvingId === activeCycle.id ? 'Approving…' : 'Approve'}
              </button>
            </div>
          )}
          {activeCycle.approvedBySenco && (
            <div className="flex items-center gap-1.5 bg-green-50 border-b border-green-100 px-3 py-1.5">
              <Icon name="check_circle" size="sm" className="text-green-600" />
              <span className="text-[11px] text-green-700">Approved · visible to all staff</span>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {SECTIONS.map(({ key, label, colour, desc }) => {
              const isEditing  = editingSection?.apdrId === activeCycle.id && editingSection?.section === key
              const content    = String(activeCycle[key as keyof ApdrRow] ?? '')
              const canEdit    = key === 'doContent' ? isStaff : isSenco
              const hasContent = content.trim().length > 0

              return (
                <div key={key} className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${COLOUR_MAP[colour].label}`}>
                        {label}
                      </span>
                      <span className="text-[10px] text-gray-400">{desc}</span>
                    </div>
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => startEdit(activeCycle.id, key as SectionKey, content)}
                        className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800"
                      >
                        <Icon name="edit" size="sm" /> Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5 mt-1">
                      <textarea
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] resize-y"
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="flex items-center gap-1 text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Icon name="save" size="sm" /> {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingSection(null)}
                          className="flex items-center gap-1 text-[11px] border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50"
                        >
                          <Icon name="close" size="sm" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[12px] ${hasContent ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                      {hasContent ? content : (label === 'Do' ? 'No notes added yet.' : label === 'Review' ? 'Review not yet completed.' : 'Not yet completed.')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Complete Review */}
          {isSenco && activeCycle.approvedBySenco && (
            <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50">
              {reviewMode === activeCycle.id ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-gray-700 flex items-center gap-1">
                    <Icon name="loop" size="sm" /> Complete Review — this will close Cycle {activeCycle.cycleNumber} and start Cycle {activeCycle.cycleNumber + 1}
                  </p>
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    placeholder="Evaluate effectiveness of this cycle…"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCompleteReview}
                      disabled={completing || !reviewText.trim()}
                      className="flex items-center gap-1 text-[11px] bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Icon name="loop" size="sm" /> {completing ? 'Completing…' : 'Complete & start next cycle'}
                    </button>
                    <button
                      onClick={() => { setReviewMode(null); setReviewText('') }}
                      className="text-[11px] border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setReviewMode(activeCycle.id); setReviewText(activeCycle.reviewContent) }}
                  className="flex items-center gap-1.5 text-[11px] text-amber-700 hover:text-amber-900 font-medium"
                >
                  <Icon name="loop" size="sm" /> Complete Review (close cycle + start next)
                </button>
              )}
            </div>
          )}

          {/* Audit trail */}
          {activeCycle.approvedBySenco && (
            <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
              <button
                onClick={() => handleToggleAudit(activeCycle.id)}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600"
              >
                <Icon name="history" size="sm" />
                {auditOpen === activeCycle.id ? 'Hide' : 'Show'} edit history
                <Icon name="chevron_right" size="sm" className={`transition-transform ${auditOpen === activeCycle.id ? 'rotate-90' : ''}`} />
              </button>

              {auditOpen === activeCycle.id && (
                <div className="mt-2">
                  {auditLoading ? (
                    <p className="text-[11px] text-gray-400 animate-pulse">Loading…</p>
                  ) : !auditEntries[activeCycle.id]?.length ? (
                    <p className="text-[11px] text-gray-400">No edits recorded yet.</p>
                  ) : (
                    <ol className="relative border-l border-gray-200 space-y-3 pl-3">
                      {auditEntries[activeCycle.id].map(e => (
                        <li key={e.id} className="relative">
                          <span className="absolute -left-[0.85rem] top-1 w-1.5 h-1.5 rounded-full bg-amber-400 border-2 border-white" />
                          <p className="text-[11px] font-medium text-gray-800">
                            {e.userName} <span className="font-normal text-gray-400">({ROLE_LABELS[e.userRole] ?? e.userRole})</span>
                            {' '}edited <span className="font-medium">{e.fieldChanged}</span>
                            {' '}on {new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {e.changeType === 'ADDED' ? (
                              <><span className="text-green-700">&ldquo;{e.newValue.slice(0, 100)}{e.newValue.length > 100 ? '…' : ''}&rdquo;</span></>
                            ) : e.changeType === 'DELETED' ? (
                              <span className="text-red-600 line-through">&ldquo;{e.previousValue.slice(0, 100)}&rdquo;</span>
                            ) : (
                              <>&ldquo;{e.previousValue.slice(0, 60)}{e.previousValue.length > 60 ? '…' : ''}&rdquo; → &ldquo;{e.newValue.slice(0, 60)}{e.newValue.length > 60 ? '…' : ''}&rdquo;</>
                            )}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed cycles history */}
      {completedCycles.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen(p => !p)}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 font-medium"
          >
            <Icon name="expand_more" size="sm" className={`transition-transform ${historyOpen ? '' : '-rotate-90'}`} />
            {completedCycles.length} completed cycle{completedCycles.length > 1 ? 's' : ''}
          </button>

          {historyOpen && (
            <div className="mt-2 space-y-2">
              {completedCycles.map(cycle => (
                <div key={cycle.id} className="border border-gray-200 rounded-xl overflow-hidden opacity-75">
                  <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-gray-600">
                      Cycle {cycle.cycleNumber} — completed {new Date(cycle.updatedAt).toLocaleDateString('en-GB')}
                    </span>
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">Completed</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {SECTIONS.map(({ key, label, colour }) => {
                      const content = String(cycle[key as keyof ApdrRow] ?? '')
                      if (!content.trim()) return null
                      return (
                        <div key={key} className="px-3 py-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${COLOUR_MAP[colour].label} mr-1.5`}>{label}</span>
                          <span className="text-[12px] text-gray-600">{content}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
