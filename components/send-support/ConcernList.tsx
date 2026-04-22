'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { ConcernRow, ConcernActionItem } from '@/app/actions/send-support'
import { addConcernAction } from '@/app/actions/send-support'
import ConcernReviewModal from './ConcernReviewModal'
import StudentAvatar from '@/components/StudentAvatar'

const STATUS_COLOURS: Record<string, string> = {
  open:         'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  escalated:    'bg-red-100 text-red-800',
  monitoring:   'bg-purple-100 text-purple-800',
  closed:       'bg-gray-100 text-gray-600',
  no_action:    'bg-gray-100 text-gray-500',
}

const CATEGORY_COLOURS: Record<string, string> = {
  literacy:         'bg-sky-100 text-sky-700',
  numeracy:         'bg-emerald-100 text-emerald-700',
  behaviour:        'bg-red-100 text-red-700',
  attendance:       'bg-orange-100 text-orange-700',
  social_emotional: 'bg-violet-100 text-violet-700',
  communication:    'bg-teal-100 text-teal-700',
  physical:         'bg-pink-100 text-pink-700',
  sensory:          'bg-indigo-100 text-indigo-700',
  other:            'bg-gray-100 text-gray-700',
}

export function ConcernStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOURS[category] ?? 'bg-gray-100 text-gray-700'}`}>
      {category.replace(/_/g, ' ')}
    </span>
  )
}

type AddActionState = {
  concernId: string
  text: string
  dueDate: string
  responsibleUserId: string
  saving: boolean
}

type Props = {
  concerns: ConcernRow[]
  isSenco?: boolean
  staffList?: { id: string; name: string; role: string }[]
  onRefresh?: () => void
}

export default function ConcernList({ concerns, isSenco = false, staffList = [], onRefresh }: Props) {
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set())
  const [reviewing,     setReviewing]     = useState<ConcernRow | null>(null)
  const [addingAction,  setAddingAction]  = useState<string | null>(null)  // concernId
  const [actionDraft,   setActionDraft]   = useState<Omit<AddActionState, 'concernId' | 'saving'>>({
    text: '', dueDate: '', responsibleUserId: '',
  })
  const [actionSaving,  setActionSaving]  = useState(false)
  const [localConcerns, setLocalConcerns] = useState(concerns)

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAddAction(concernId: string) {
    if (!actionDraft.text.trim()) return
    setActionSaving(true)
    try {
      await addConcernAction(
        concernId,
        actionDraft.text.trim(),
        actionDraft.dueDate || null,
        actionDraft.responsibleUserId || null,
      )
      // Optimistically update local state
      setLocalConcerns(prev => prev.map(c => {
        if (c.id !== concernId) return c
        const responsibleUser = staffList.find(s => s.id === actionDraft.responsibleUserId)
        const newItem: ConcernActionItem = {
          text: actionDraft.text.trim(),
          dueDate: actionDraft.dueDate || null,
          responsibleUserId: actionDraft.responsibleUserId || null,
          responsibleUserName: responsibleUser?.name ?? null,
          createdAt: new Date().toISOString(),
        }
        return { ...c, actionItems: [...c.actionItems, newItem] }
      }))
      setAddingAction(null)
      setActionDraft({ text: '', dueDate: '', responsibleUserId: '' })
      onRefresh?.()
    } finally {
      setActionSaving(false)
    }
  }

  if (concerns.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Icon name="check_circle" size="lg" className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No concerns on record.</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {localConcerns.map(c => {
          const isOpen = expanded.has(c.id)
          return (
            <div key={c.id} className="py-3">
              <button
                className="w-full text-left flex items-start gap-3"
                onClick={() => toggle(c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <StudentAvatar
                        firstName={c.studentName.split(' ')[0] ?? ''}
                        lastName={c.studentName.split(' ').slice(1).join(' ') || c.studentName}
                        avatarUrl={c.studentAvatarUrl}
                        size="xs"
                        userId={c.studentId}
                      />
                      <span className="text-sm font-medium text-gray-900">{c.studentName}</span>
                    </span>
                    <CategoryBadge category={c.category} />
                    <ConcernStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleDateString('en-GB')} · raised by {c.raiserName}
                  </p>
                  {!isOpen && (
                    <p className="text-sm text-gray-700 mt-1 line-clamp-1">{c.description}</p>
                  )}
                </div>
                {isOpen ? <Icon name="expand_less" size="sm" className="text-gray-400 shrink-0 mt-0.5" /> : <Icon name="expand_more" size="sm" className="text-gray-400 shrink-0 mt-0.5" />}
              </button>

              {isOpen && (
                <div className="mt-3 pl-2 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-800">{c.description}</p>
                  </div>

                  {c.evidenceNotes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Evidence / observations</p>
                      <p className="text-sm text-gray-800">{c.evidenceNotes}</p>
                    </div>
                  )}

                  {c.reviewNotes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">SENCO review notes</p>
                      <p className="text-sm text-gray-800">{c.reviewNotes}</p>
                      {c.reviewedAt && (
                        <p className="text-xs text-gray-400 mt-1">Reviewed {new Date(c.reviewedAt).toLocaleDateString('en-GB')}</p>
                      )}
                    </div>
                  )}

                  {c.aiAnalysis && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon name="smart_toy" size="sm" className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">AI-assisted analysis</span>
                      </div>
                      <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{c.aiAnalysis}</p>
                    </div>
                  )}

                  {/* Action items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-500">
                        Action points {c.actionItems.length > 0 ? `(${c.actionItems.length})` : ''}
                      </p>
                      {isSenco && (
                        <button
                          onClick={() => {
                            setAddingAction(addingAction === c.id ? null : c.id)
                            setActionDraft({ text: '', dueDate: '', responsibleUserId: '' })
                          }}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800"
                        >
                          <Icon name="add_circle" size="sm" /> Add action
                        </button>
                      )}
                    </div>
                    {c.actionItems.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {c.actionItems.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                            <Icon name="task_alt" size="sm" className="text-blue-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-gray-800">{a.text}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {a.responsibleUserName && <span className="font-medium">{a.responsibleUserName} · </span>}
                                {a.dueDate ? `Due ${new Date(a.dueDate).toLocaleDateString('en-GB')}` : 'No due date'}
                                {' · '}Added {new Date(a.createdAt).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {addingAction === c.id && (
                      <div className="border border-blue-200 rounded-xl p-3 bg-blue-50 space-y-2">
                        <textarea
                          value={actionDraft.text}
                          onChange={e => setActionDraft(d => ({ ...d, text: e.target.value }))}
                          placeholder="Describe the action to be taken…"
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-0.5">Due date</label>
                            <input
                              type="date"
                              value={actionDraft.dueDate}
                              onChange={e => setActionDraft(d => ({ ...d, dueDate: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                          {staffList.length > 0 && (
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-500 block mb-0.5">Responsible</label>
                              <select
                                value={actionDraft.responsibleUserId}
                                onChange={e => setActionDraft(d => ({ ...d, responsibleUserId: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-300"
                              >
                                <option value="">— Select staff —</option>
                                {staffList.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setAddingAction(null)}
                            className="px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAddAction(c.id)}
                            disabled={!actionDraft.text.trim() || actionSaving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionSaving ? <><Icon name="refresh" size="sm" className="animate-spin" /> Saving…</> : <><Icon name="check_circle" size="sm" /> Save action</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isSenco && c.status !== 'closed' && c.status !== 'no_action' && (
                      <button
                        onClick={() => setReviewing(c)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                      >
                        Review Concern
                      </button>
                    )}
                    <Link
                      href="/messages"
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Icon name="chat" size="sm" />
                      {isSenco ? 'Message teacher' : 'Message SENCO'}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {reviewing && (
        <ConcernReviewModal
          concern={reviewing}
          onClose={() => { setReviewing(null); onRefresh?.() }}
        />
      )}
    </>
  )
}
