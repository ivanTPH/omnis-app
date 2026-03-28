'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { LearnerPassportRow } from '@/app/actions/send-support'
import { approveLearnerPassport, regenerateLearnerPassport } from '@/app/actions/send-support'

type Props = {
  passport:    LearnerPassportRow
  studentName: string
  studentId:   string
  userRole:    string
  onClose:     () => void
  onUpdated:   () => void
}

export default function KPlanModal({ passport, studentName, studentId, userRole, onClose, onUpdated }: Props) {
  const [approving,    setApproving]    = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [checked,      setChecked]      = useState<boolean[]>(() => new Array(passport.teacherActions.length).fill(false))
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(userRole)

  function toggleCheck(i: number) {
    setChecked(prev => { const next = [...prev]; next[i] = !next[i]; return next })
  }

  async function handleApprove() {
    setApproving(true)
    try {
      await approveLearnerPassport(passport.id)
      onUpdated()
    } finally {
      setApproving(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm(`Regenerate K Plan for ${studentName}? This will overwrite the current draft.`)) return
    setRegenerating(true)
    try {
      await regenerateLearnerPassport(studentId)
      onUpdated()
    } finally {
      setRegenerating(false)
    }
  }

  const firstName = studentName.split(' ')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">K Plan — Learning Passport</p>
            <h2 className="text-lg font-bold">{studentName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {passport.status === 'APPROVED' && (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 bg-green-600 text-white rounded-full">
                <Icon name="check_circle" size="sm" /> Approved
              </span>
            )}
            {passport.status === 'DRAFT' && (
              <span className="text-[11px] font-semibold px-2.5 py-1 bg-amber-500 text-white rounded-full">
                Draft
              </span>
            )}
            {isSenco && (
              <>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {regenerating ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="refresh" size="sm" />}
                  Regenerate
                </button>
                {passport.status === 'DRAFT' && (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {approving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="verified_user" size="sm" />}
                    Approve
                  </button>
                )}
              </>
            )}
            <a
              href={`/api/export/k-plan/${studentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Icon name="download" size="sm" /> Export PDF
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <Icon name="close" size="sm" />
            </button>
          </div>
        </div>

        {/* Three-column body */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-3 gap-0 h-full min-h-[400px]">

            {/* Column 1 — SEND Information */}
            <div className="border-r border-gray-200 bg-blue-50">
              <div className="sticky top-0 bg-blue-600 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">SEND Information</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[13px] text-blue-900 leading-relaxed whitespace-pre-wrap">
                  {passport.sendInformation || <span className="text-gray-400 italic">Not yet generated.</span>}
                </p>
              </div>
            </div>

            {/* Column 2 — It would help me if you could */}
            <div className="border-r border-gray-200 bg-purple-50">
              <div className="sticky top-0 bg-purple-700 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-100">It would help me if you could</p>
              </div>
              <div className="px-5 py-4">
                {passport.teacherActions.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic">Not yet generated.</p>
                ) : (
                  <>
                    <p className="text-[10px] text-purple-400 italic mb-3">Tick off as reminders — not saved</p>
                    <ul className="space-y-3">
                      {passport.teacherActions.map((action, i) => (
                        <li key={i}>
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked[i] ?? false}
                              onChange={() => toggleCheck(i)}
                              className="mt-0.5 w-4 h-4 rounded border-purple-300 cursor-pointer"
                              style={{ accentColor: '#7c3aed' }}
                            />
                            <span className={`text-[13px] leading-snug ${checked[i] ? 'line-through text-purple-300' : 'text-purple-900'}`}>
                              {action}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {/* Column 3 — I will help myself by */}
            <div className="bg-green-50">
              <div className="sticky top-0 bg-green-700 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-100">I will help myself by</p>
                <p className="text-[10px] text-green-200 mt-0.5 italic">{firstName}&apos;s own commitments</p>
              </div>
              <div className="px-5 py-4">
                {passport.studentCommitments.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic">Not yet generated.</p>
                ) : (
                  <ul className="space-y-3">
                    {passport.studentCommitments.map((commitment, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px] text-green-900">
                        <span className="mt-1 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        {commitment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 shrink-0 flex items-center justify-between gap-4">
          <span>
            {passport.approvedAt
              ? `Approved ${new Date(passport.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · `
              : ''}
            This document is confidential. Share only with staff who teach {firstName}.
          </span>
          <a
            href={`/student/${studentId}/send`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-blue-500 hover:text-blue-700 font-medium"
          >
            Full SEND record →
          </a>
        </div>
      </div>
    </div>
  )
}
