'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { IlpWithTargets, PendingIlpEdit } from '@/app/actions/send-support'
import { getPendingIlpEdits, approveIlpEdit, rejectIlpEdit } from '@/app/actions/send-support'
import IlpCard from './IlpCard'
import IlpForm from './IlpForm'

type GenerateState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; generated: number; skipped: number; errors: string[] }

type Props = { ilps: IlpWithTargets[] }

export default function IlpPageView({ ilps: initial }: Props) {
  const [ilps,           setIlps]           = useState(initial)
  const [showForm,       setShowForm]       = useState(false)
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set())
  const [studentId,      setStudentId]      = useState('')
  const [studentName,    setStudentName]    = useState('')
  const [genState,       setGenState]       = useState<GenerateState>({ phase: 'idle' })
  const [pendingEdits,   setPendingEdits]   = useState<PendingIlpEdit[]>([])
  const [editAction,     setEditAction]     = useState<Record<string, 'approving' | 'rejecting'>>({})
  const [rejectReason,   setRejectReason]   = useState<Record<string, string>>({})
  const [rejectOpen,     setRejectOpen]     = useState<Record<string, boolean>>({})

  useEffect(() => {
    getPendingIlpEdits().then(setPendingEdits).catch(() => {})
  }, [])

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
      // Reload the page after a short delay so new ILPs appear in the list
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setGenState({ phase: 'done', generated: 0, skipped: 0, errors: ['Request failed — check server logs.'] })
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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

  const reviewSoon = ilps.filter(i => {
    const daysUntil = (new Date(i.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntil <= 14 && daysUntil >= 0
  })

  return (
    <div className="space-y-4">
      {/* Summary */}
      {reviewSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800">
          ⏰ {reviewSoon.length} ILP{reviewSoon.length > 1 ? 's' : ''} due for review within 14 days.
        </div>
      )}

      {/* Generate ILPs result banner */}
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

      {/* Create ILP form trigger */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{ilps.length} ILP{ilps.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateIlps}
            disabled={genState.phase === 'loading'}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60"
          >
            {genState.phase === 'loading'
              ? <><Icon name="refresh" size="sm" className="animate-spin" /> Generating…</>
              : <><Icon name="auto_awesome" size="sm" /> Generate ILPs</>
            }
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Icon name="add" size="sm" /> Create ILP
          </button>
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

      {/* ILP list */}
      {ilps.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Icon name="favorite_border" size="lg" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active ILPs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ilps.map(ilp => (
            <div key={ilp.id} className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleExpand(ilp.id)}
                className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{ilp.studentName}</p>
                  <p className="text-sm text-gray-500">
                    {ilp.sendCategory} · {ilp.targets.length} target{ilp.targets.length !== 1 ? 's' : ''} ·
                    review {new Date(ilp.reviewDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ilp.autoGenerated && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Icon name="auto_awesome" size="sm" /> AI
                    </span>
                  )}
                  {(new Date(ilp.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 14 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Review due</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ilp.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-700'}`}>
                    {ilp.status === 'under_review' ? 'Needs approval' : ilp.status}
                  </span>
                </div>
              </button>
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
    </div>
  )
}
