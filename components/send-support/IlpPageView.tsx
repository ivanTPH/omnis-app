'use client'

import { useState, useEffect, useMemo } from 'react'
import Icon from '@/components/ui/Icon'
import type { IlpWithTargets, PendingIlpEdit, GeneratedIlpGoal, StudentWithoutIlp } from '@/app/actions/send-support'
import {
  getPendingIlpEdits, approveIlpEdit, rejectIlpEdit,
  generateIlpGoalsForStudent, createIlp, approveGeneratedIlp,
} from '@/app/actions/send-support'
import IlpCard from './IlpCard'
import IlpForm from './IlpForm'

// ── Bulk generate state ────────────────────────────────────────────────────────

type GenerateState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; generated: number; skipped: number; errors: string[] }

// ── Per-student AI generate modal ─────────────────────────────────────────────

type AiGoalDraft = {
  targetDescription: string
  successCriteria:   string
  teacherStrategy:   string
}

type AiModalState =
  | { phase: 'idle' }
  | { phase: 'generating'; studentId: string; studentName: string }
  | { phase: 'review';     studentId: string; studentName: string; sendCategory: string; subject: string; goals: AiGoalDraft[] }
  | { phase: 'saving' }
  | { phase: 'done'; studentName: string }
  | { phase: 'error'; message: string }

// ── Component ─────────────────────────────────────────────────────────────────

type Props = { ilps: IlpWithTargets[]; studentsWithoutIlp?: StudentWithoutIlp[] }

export default function IlpPageView({ ilps: initial, studentsWithoutIlp = [] }: Props) {
  const [ilps,           setIlps]           = useState(initial)
  const [showForm,       setShowForm]       = useState(false)
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set())
  const [studentId,      setStudentId]      = useState('')
  const [studentName,    setStudentName]    = useState('')
  const [genState,       setGenState]       = useState<GenerateState>({ phase: 'idle' })
  const [ilpProgress,    setIlpProgress]    = useState(0)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [yearFilter,     setYearFilter]     = useState('')
  const [viewMode,       setViewMode]       = useState<'active' | 'no_ilp'>('active')
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [batchGenState,  setBatchGenState]  = useState<'idle' | 'running' | 'done'>('idle')

  // Simulated progress bar for bulk ILP generation (up to 60s)
  useEffect(() => {
    if (genState.phase !== 'loading') {
      if (genState.phase === 'done') setIlpProgress(100)
      return
    }
    setIlpProgress(0)
    const interval = setInterval(() => {
      setIlpProgress(p => {
        if (p >= 88) return p
        const step = p < 40 ? 9 : p < 65 ? 5 : p < 80 ? 2 : 0.5
        return Math.min(p + step, 88)
      })
    }, 700)
    return () => clearInterval(interval)
  }, [genState.phase])
  const [pendingEdits,   setPendingEdits]   = useState<PendingIlpEdit[]>([])
  const [editAction,     setEditAction]     = useState<Record<string, 'approving' | 'rejecting'>>({})
  const [rejectReason,   setRejectReason]   = useState<Record<string, string>>({})
  const [rejectOpen,     setRejectOpen]     = useState<Record<string, boolean>>({})
  const [aiModal,        setAiModal]        = useState<AiModalState>({ phase: 'idle' })
  const [approveAction,  setApproveAction]  = useState<Record<string, boolean>>({})

  useEffect(() => {
    getPendingIlpEdits().then(setPendingEdits).catch(() => {})
  }, [])

  // ── Bulk generate ───────────────────────────────────────────────────────────

  async function handleGenerateIlps() {
    setGenState({ phase: 'loading' })
    try {
      const res  = await fetch('/api/senco/generate-ilps', { method: 'POST' })
      const text = await res.text()
      let data: { generated?: number; skipped?: number; errors?: string[] }
      try { data = JSON.parse(text) } catch { data = {} }
      setGenState({
        phase:     'done',
        generated: data.generated ?? 0,
        skipped:   data.skipped   ?? 0,
        errors:    data.errors    ?? [],
      })
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setGenState({ phase: 'done', generated: 0, skipped: 0, errors: ['Request failed — check server logs.'] })
    }
  }

  // ── Per-student AI generate ─────────────────────────────────────────────────

  async function handleAiGenerate(ilp: IlpWithTargets) {
    setAiModal({ phase: 'generating', studentId: ilp.studentId, studentName: ilp.studentName })
    const result = await generateIlpGoalsForStudent(ilp.studentId)
    if (!result.ok) {
      setAiModal({ phase: 'error', message: result.error })
      return
    }
    setAiModal({
      phase:       'review',
      studentId:   ilp.studentId,
      studentName: ilp.studentName,
      sendCategory: result.sendCategory,
      subject:     result.subject,
      goals:       result.goals.map(g => ({ ...g })),
    })
  }

  function updateGoalField(idx: number, field: keyof AiGoalDraft, value: string) {
    setAiModal(prev => {
      if (prev.phase !== 'review') return prev
      const goals = prev.goals.map((g, i) => i === idx ? { ...g, [field]: value } : g)
      return { ...prev, goals }
    })
  }

  async function handleConfirmAiGoals() {
    if (aiModal.phase !== 'review') return
    setAiModal({ phase: 'saving' })
    const reviewDate = new Date()
    reviewDate.setDate(reviewDate.getDate() + 91) // ~13 weeks

    try {
      await createIlp({
        studentId:        aiModal.studentId,
        sendCategory:     aiModal.sendCategory,
        currentStrengths: `Student has been identified with ${aiModal.sendCategory}. Strengths to be determined at initial review meeting.`,
        areasOfNeed:      `Support required in ${aiModal.subject} — see targets below.`,
        strategies:       aiModal.goals.map(g => g.teacherStrategy),
        successCriteria:  aiModal.goals.map(g => g.successCriteria).join('; '),
        reviewDate,
        targets: aiModal.goals.map(g => ({
          target:         g.targetDescription,
          strategy:       g.teacherStrategy,
          successMeasure: g.successCriteria,
          targetDate:     reviewDate,
        })),
      })
      setAiModal({ phase: 'done', studentName: aiModal.studentName })
      setTimeout(() => { setAiModal({ phase: 'idle' }); window.location.reload() }, 1800)
    } catch (err) {
      setAiModal({ phase: 'error', message: String(err).slice(0, 200) })
    }
  }

  // ── Expand ──────────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Approve / reject edits ──────────────────────────────────────────────────

  async function handleApproveEdit(id: string) {
    setEditAction(a => ({ ...a, [id]: 'approving' }))
    try {
      await approveIlpEdit(id)
      setPendingEdits(prev => prev.filter(e => e.id !== id))
    } finally {
      setEditAction(a => { const n = { ...a }; delete n[id]; return n })
    }
  }

  async function handleRejectEdit(id: string) {
    setEditAction(a => ({ ...a, [id]: 'rejecting' }))
    try {
      await rejectIlpEdit(id, rejectReason[id] ?? '')
      setPendingEdits(prev => prev.filter(e => e.id !== id))
      setRejectOpen(r => { const n = { ...r }; delete n[id]; return n })
    } finally {
      setEditAction(a => { const n = { ...a }; delete n[id]; return n })
    }
  }

  async function handleApproveIlp(ilpId: string) {
    setApproveAction(a => ({ ...a, [ilpId]: true }))
    try {
      await approveGeneratedIlp(ilpId)
      window.location.reload()
    } finally {
      setApproveAction(a => { const n = { ...a }; delete n[ilpId]; return n })
    }
  }

  const reviewSoon = ilps.filter(i => {
    const daysUntil = (new Date(i.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntil <= 14 && daysUntil >= 0
  })

  // Derived year options
  const yearOptions = useMemo(() => {
    const years = new Set([
      ...ilps.map(i => i.yearGroup).filter((y): y is number => y != null),
      ...studentsWithoutIlp.map(s => s.yearGroup).filter((y): y is number => y != null),
    ])
    return [...years].sort((a, b) => a - b)
  }, [ilps, studentsWithoutIlp])

  // Filtered ILP list
  const filteredIlps = useMemo(() => ilps.filter(i => {
    if (yearFilter && i.yearGroup !== Number(yearFilter)) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!i.studentName.toLowerCase().includes(q)) return false
    }
    return true
  }), [ilps, yearFilter, searchQuery])

  // Filtered students without ILP
  const filteredWithoutIlp = useMemo(() => studentsWithoutIlp.filter(s => {
    if (yearFilter && s.yearGroup !== Number(yearFilter)) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!s.studentName.toLowerCase().includes(q)) return false
    }
    return true
  }), [studentsWithoutIlp, yearFilter, searchQuery])

  async function handleBatchGenerate() {
    if (selectedIds.size === 0) return
    setBatchGenState('running')
    try {
      for (const id of selectedIds) {
        await generateIlpGoalsForStudent(id)
      }
    } catch { /* ignore individual failures */ }
    setBatchGenState('done')
    setSelectedIds(new Set())
    setTimeout(() => { setBatchGenState('idle'); window.location.reload() }, 1500)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredWithoutIlp.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredWithoutIlp.map(s => s.id)))
    }
  }

  // ── AI modal UI ─────────────────────────────────────────────────────────────

  function AiModal() {
    if (aiModal.phase === 'idle') return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" size="md" className="text-purple-600" />
              <h2 className="font-semibold text-gray-900">AI-Generated ILP Goals</h2>
            </div>
            {aiModal.phase !== 'saving' && aiModal.phase !== 'done' && (
              <button onClick={() => setAiModal({ phase: 'idle' })} className="p-1.5 rounded-lg hover:bg-gray-100">
                <Icon name="close" size="md" />
              </button>
            )}
          </div>

          <div className="p-6">
            {/* Generating */}
            {aiModal.phase === 'generating' && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Icon name="refresh" size="lg" className="animate-spin text-purple-600" />
                <p className="text-sm text-gray-600">
                  Generating 3 SMART ILP goals for <strong>{aiModal.studentName}</strong>…
                </p>
              </div>
            )}

            {/* Review & edit */}
            {aiModal.phase === 'review' && (
              <div className="space-y-5">
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800">
                  <strong>{aiModal.studentName}</strong> · {aiModal.sendCategory} · {aiModal.subject}
                </div>
                <p className="text-[13px] text-gray-500">
                  Review and edit the AI-generated goals below before creating the ILP.
                </p>

                {aiModal.goals.map((goal, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Goal {idx + 1}</p>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Target</label>
                      <textarea
                        value={goal.targetDescription}
                        onChange={e => updateGoalField(idx, 'targetDescription', e.target.value)}
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Success criteria</label>
                      <textarea
                        value={goal.successCriteria}
                        onChange={e => updateGoalField(idx, 'successCriteria', e.target.value)}
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Teacher strategy</label>
                      <textarea
                        value={goal.teacherStrategy}
                        onChange={e => updateGoalField(idx, 'teacherStrategy', e.target.value)}
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setAiModal({ phase: 'idle' })}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAiGoals}
                    className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                  >
                    <Icon name="check_circle" size="sm" /> Create ILP
                  </button>
                </div>
              </div>
            )}

            {/* Saving */}
            {aiModal.phase === 'saving' && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Icon name="refresh" size="lg" className="animate-spin text-purple-600" />
                <p className="text-sm text-gray-600">Creating ILP…</p>
              </div>
            )}

            {/* Done */}
            {aiModal.phase === 'done' && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Icon name="check_circle" size="lg" className="text-green-600" />
                <p className="text-sm text-gray-700 font-medium">
                  ILP created for <strong>{aiModal.studentName}</strong>
                </p>
                <p className="text-xs text-gray-400">Refreshing…</p>
              </div>
            )}

            {/* Error */}
            {aiModal.phase === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
                  {aiModal.message}
                </div>
                <button
                  onClick={() => setAiModal({ phase: 'idle' })}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ILP generation progress overlay */}
      {genState.phase === 'loading' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-7 text-center space-y-5">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <Icon name="auto_awesome" size="md" className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-gray-900">Generating ILP Goals</h3>
              <p className="text-[12px] text-gray-500 mt-1">
                {ilpProgress < 30 ? 'Fetching student performance data…'
                  : ilpProgress < 60 ? 'Generating personalised targets…'
                  : ilpProgress < 85 ? 'Finalising ILP goals…'
                  : 'Almost done…'}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${ilpProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 text-right">{Math.round(ilpProgress)}%</p>
            </div>
            <p className="text-[11px] text-gray-400">This may take up to 60 seconds</p>
          </div>
        </div>
      )}
      {/* Summary */}
      {reviewSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800">
          ⏰ {reviewSoon.length} ILP{reviewSoon.length > 1 ? 's' : ''} due for review within 14 days.
        </div>
      )}

      {/* Bulk generate result banner */}
      {genState.phase === 'done' && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${genState.errors.length > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          <p className="font-medium">
            ILP generation complete — {genState.generated} generated, {genState.skipped} skipped (already had ILP).
          </p>
          {genState.errors.length > 0 && (
            <ul className="mt-1 text-xs space-y-0.5 opacity-80">
              {genState.errors.map((e, i) => <li key={i}>· {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* View mode tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('active')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${viewMode === 'active' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Active ILPs ({ilps.length})
          </button>
          {studentsWithoutIlp.length > 0 && (
            <button
              onClick={() => setViewMode('no_ilp')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'no_ilp' ? 'bg-amber-500 text-white' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
            >
              <Icon name="warning" size="sm" />
              SEND without ILP ({studentsWithoutIlp.length})
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleGenerateIlps}
            disabled={genState.phase === 'loading'}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[12px] font-medium hover:bg-purple-700 disabled:opacity-60"
            title="Auto-generate ILP goals for all SEND students who don't yet have an ILP"
          >
            {genState.phase === 'loading'
              ? <><Icon name="refresh" size="sm" className="animate-spin" /> Generating…</>
              : <><Icon name="auto_awesome" size="sm" /> Generate all missing ILPs</>
            }
          </button>
        </div>

        {/* Search + year filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by student name…"
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">All years</option>
            {yearOptions.map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>

      {/* Pending teacher edits */}
      {pendingEdits.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <Icon name="edit_note" size="sm" className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              Pending teacher edits ({pendingEdits.length})
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingEdits.map(edit => (
              <div key={edit.id} className="px-5 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-gray-900">
                      {edit.studentName}
                      <span className="ml-2 text-[11px] text-gray-500 font-normal">field: {edit.fieldChanged}</span>
                    </p>
                    <p className="text-[12px] text-gray-500">Proposed by {edit.proposerName}</p>
                    <div className="mt-1 flex items-center gap-2 text-[12px]">
                      {edit.previousValue && (
                        <span className="line-through text-gray-400">&ldquo;{edit.previousValue.slice(0, 60)}&rdquo;</span>
                      )}
                      <span className="text-green-700">&rarr; &ldquo;{edit.newValue?.slice(0, 80)}&rdquo;</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveEdit(edit.id)}
                      disabled={!!editAction[edit.id]}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {editAction[edit.id] === 'approving'
                        ? <Icon name="refresh" size="sm" className="animate-spin" />
                        : <Icon name="check_circle" size="sm" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectOpen(r => ({ ...r, [edit.id]: !r[edit.id] }))}
                      disabled={!!editAction[edit.id]}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <Icon name="cancel" size="sm" /> Reject
                    </button>
                  </div>
                </div>
                {rejectOpen[edit.id] && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={rejectReason[edit.id] ?? ''}
                      onChange={e => setRejectReason(r => ({ ...r, [edit.id]: e.target.value }))}
                      placeholder="Reason (optional)…"
                      className="flex-1 text-[12px] border border-gray-200 rounded-lg px-2.5 py-1"
                    />
                    <button
                      onClick={() => handleRejectEdit(edit.id)}
                      disabled={editAction[edit.id] === 'rejecting'}
                      className="text-[11px] font-medium px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {editAction[edit.id] === 'rejecting' ? <Icon name="refresh" size="sm" className="animate-spin" /> : 'Confirm reject'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ILP list / no-ILP view */}
      {viewMode === 'no_ilp' ? (
        <div className="space-y-3">
          {filteredWithoutIlp.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Icon name="check_circle" size="lg" className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">All SEND students have an ILP.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredWithoutIlp.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                  <span className="text-[12px] text-gray-600">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filteredWithoutIlp.length} students`}
                  </span>
                </div>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBatchGenerate}
                    disabled={batchGenState === 'running'}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[12px] font-medium hover:bg-purple-700 disabled:opacity-60"
                  >
                    {batchGenState === 'running'
                      ? <><Icon name="refresh" size="sm" className="animate-spin" /> Generating…</>
                      : batchGenState === 'done'
                      ? <><Icon name="check_circle" size="sm" /> Done</>
                      : <><Icon name="auto_awesome" size="sm" /> Generate ILP{selectedIds.size > 1 ? 's' : ''} for {selectedIds.size} student{selectedIds.size > 1 ? 's' : ''}</>
                    }
                  </button>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {filteredWithoutIlp.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="rounded border-gray-300 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900">{s.studentName}</p>
                      <p className="text-[11px] text-gray-500">
                        {s.yearGroup ? `Year ${s.yearGroup}` : ''}
                        {s.yearGroup && s.needArea ? ' · ' : ''}
                        {s.needArea ?? s.sendStatus.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.sendStatus === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.sendStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : filteredIlps.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Icon name="favorite_border" size="lg" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery || yearFilter ? 'No ILPs match your search.' : 'No active ILPs.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIlps.map(ilp => (
            <div key={ilp.id} className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="w-full flex items-center justify-between hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => toggleExpand(ilp.id)}
                  className="flex-1 text-left px-5 py-4"
                >
                  <p className="font-medium text-gray-900">{ilp.studentName}</p>
                  <p className="text-sm text-gray-500">
                    {ilp.yearGroup ? `Year ${ilp.yearGroup} · ` : ''}{ilp.sendCategory} · {ilp.targets.length} target{ilp.targets.length !== 1 ? 's' : ''} ·
                    review {new Date(ilp.reviewDate).toLocaleDateString('en-GB')}
                  </p>
                </button>
                <div className="flex items-center gap-2 px-4">
                  {/* Per-student AI generate button */}
                  <button
                    onClick={() => handleAiGenerate(ilp)}
                    title="Re-generate ILP goals using AI — Claude analyses this student's SEND category, assessment history, and learning profile to suggest 3 SMART targets. You review and edit before saving."
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors"
                  >
                    <Icon name="auto_awesome" size="sm" /> AI Goals
                  </button>
                  {ilp.autoGenerated && (
                    <span
                      title="This ILP's goals were generated by AI (Claude) and approved by a SENCO. AI-generated ILPs are based on the student's SEND category and performance data."
                      className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help"
                    >
                      <Icon name="auto_awesome" size="sm" /> AI
                    </span>
                  )}
                  {(new Date(ilp.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 14 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Review due</span>
                  )}
                  {ilp.status === 'under_review' ? (
                    <>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Draft — awaiting approval
                      </span>
                      <button
                        onClick={() => handleApproveIlp(ilp.id)}
                        disabled={approveAction[ilp.id]}
                        className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60"
                      >
                        {approveAction[ilp.id]
                          ? <><Icon name="refresh" size="sm" className="animate-spin" /> Approving…</>
                          : <><Icon name="check_circle" size="sm" /> Approve &amp; Publish</>
                        }
                      </button>
                    </>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Published
                    </span>
                  )}
                  <button onClick={() => toggleExpand(ilp.id)} className="p-1 text-gray-400 hover:text-gray-600">
                    <Icon name={expanded.has(ilp.id) ? 'expand_less' : 'expand_more'} size="md" />
                  </button>
                </div>
              </div>
              {expanded.has(ilp.id) && (
                <div className="border-t border-gray-100 p-4">
                  <IlpCard ilp={ilp} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create ILP modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
              <h2 className="font-semibold text-gray-900">Create Individual Learning Plan</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <Icon name="close" size="md" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!studentId ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Enter the student&apos;s User ID to create an ILP:</p>
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    placeholder="Student User ID…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="Student name…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    disabled={!studentId || !studentName}
                    onClick={() => {}}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >Continue</button>
                </div>
              ) : (
                <IlpForm
                  studentId={studentId}
                  studentName={studentName}
                  onClose={() => { setShowForm(false); setStudentId(''); setStudentName('') }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI generate modal */}
      <AiModal />
    </div>
  )
}
