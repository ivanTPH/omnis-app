'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { LearnerPassportRow } from '@/app/actions/send-support'
import { approveLearnerPassport, regenerateLearnerPassport, generateLearnerPassport } from '@/app/actions/send-support'
import KPlanModal from './KPlanModal'

type Props = {
  passport:    LearnerPassportRow | null
  studentId:   string
  studentName: string
  userRole:    string
}

export default function KPlanSection({ passport: initial, studentId, studentName, userRole }: Props) {
  const [passport,     setPassport]     = useState<LearnerPassportRow | null>(initial)
  const [expanded,     setExpanded]     = useState(false)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [approving,    setApproving]    = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [generating,   setGenerating]   = useState(false)

  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(userRole)
  const firstName = studentName.split(' ')[0]

  async function handleApprove() {
    if (!passport) return
    setApproving(true)
    try {
      await approveLearnerPassport(passport.id)
      setPassport({ ...passport, status: 'APPROVED' })
    } finally {
      setApproving(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm(`Regenerate K Plan for ${studentName}? This will overwrite the current draft.`)) return
    setRegenerating(true)
    try {
      const res = await regenerateLearnerPassport(studentId)
      if (res.success) {
        // Reload via server action
        const { getStudentLearnerPassport } = await import('@/app/actions/send-support')
        const fresh = await getStudentLearnerPassport(studentId)
        setPassport(fresh)
      }
    } finally {
      setRegenerating(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await generateLearnerPassport(studentId)
      if (res.success) {
        const { getStudentLearnerPassport } = await import('@/app/actions/send-support')
        const fresh = await getStudentLearnerPassport(studentId)
        setPassport(fresh)
      }
    } finally {
      setGenerating(false)
    }
  }

  // No K Plan yet
  if (!passport) {
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon name="menu_book" size="md" className="text-teal-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-800">No K Plan yet</p>
            <p className="text-xs text-teal-600 mt-0.5">
              The K Plan synthesises ILP, EHCP, and APDR data into a ready-to-use classroom reference.
            </p>
          </div>
        </div>
        {isSenco && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            {generating ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="menu_book" size="sm" />}
            Generate K Plan
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Header bar */}
        <div className={`px-4 py-3 flex items-center justify-between gap-3 ${
          passport.status === 'APPROVED' ? 'bg-teal-50 border-b border-teal-100' : 'bg-amber-50 border-b border-amber-100'
        }`}>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <Icon name="menu_book" size="sm" className={passport.status === 'APPROVED' ? 'text-teal-600' : 'text-amber-600'} />
            <span className="text-sm font-semibold text-gray-800">
              {passport.status === 'APPROVED' ? 'K Plan — Approved' : 'K Plan — Draft (awaiting SENCO approval)'}
            </span>
            {expanded ? <Icon name="expand_less" size="sm" className="text-gray-400 ml-auto" /> : <Icon name="expand_more" size="sm" className="text-gray-400 ml-auto" />}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            {isSenco && (
              <>
                {passport.status === 'DRAFT' && (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {approving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="verified_user" size="sm" />}
                    Approve
                  </button>
                )}
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {regenerating ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="refresh" size="sm" />}
                  Regenerate
                </button>
              </>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
            >
              <Icon name="menu_book" size="sm" /> Full view
            </button>
            <a
              href={`/api/export/k-plan/${studentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <Icon name="download" size="sm" /> PDF
            </a>
          </div>
        </div>

        {/* 2-line SEND info preview (always visible) */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">SEND Information</p>
          <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{passport.sendInformation}</p>
        </div>

        {/* Expandable three-column section */}
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Teacher actions */}
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">It would help me if you could</p>
              <ul className="space-y-1.5">
                {passport.teacherActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                    <span className="mt-0.5 w-4 h-4 shrink-0 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[9px] font-bold">{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {/* Student commitments */}
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">I will help myself by</p>
              <p className="text-[11px] text-gray-400 italic mb-2">{firstName}&apos;s own commitments</p>
              <ul className="space-y-1.5">
                {passport.studentCommitments.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen modal */}
      {modalOpen && (
        <KPlanModal
          passport={passport}
          studentName={studentName}
          studentId={studentId}
          userRole={userRole}
          onClose={() => setModalOpen(false)}
          onUpdated={async () => {
            setModalOpen(false)
            const { getStudentLearnerPassport } = await import('@/app/actions/send-support')
            const fresh = await getStudentLearnerPassport(studentId)
            setPassport(fresh)
          }}
        />
      )}
    </>
  )
}
