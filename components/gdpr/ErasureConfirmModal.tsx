'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { executeErasure } from '@/app/actions/gdpr'

type Props = {
  dsrId: string
  studentName: string
  onClose: () => void
  onDone: (name: string) => void
}

const DELETED_DATA = [
  'Homework submissions and answers',
  'TA notes and teacher notes',
  'Parent contact log entries',
  'SEND concerns and early warning flags',
  'Student learning profile and AI snapshots',
  'Revision sessions, exams, and confidence ratings',
  'Messaging history',
  'Class enrolments and subject options',
  'Consent records',
  'Account settings and login credentials',
  'K Plan / Learning Passport',
  'User PII (name anonymised to "[Deleted User]", email to erased-…@erased.local)',
]

const RETAINED_DATA = [
  'ILP and ILP targets — 7-year DfE retention obligation',
  'EHCP plans and outcomes — 7-year DfE retention obligation',
  'APDR cycles — 7-year DfE retention obligation',
  'Audit log entries — audit trail integrity',
  'SEND status record — safeguarding obligation',
  'This data subject request record — GDPR compliance evidence',
]

export default function ErasureConfirmModal({ dsrId, studentName, onClose, onDone }: Props) {
  const [confirmText, setConfirm] = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isReady = confirmText.trim().toUpperCase() === 'CONFIRM'

  function handleExecute() {
    if (!isReady) return
    setError(null)
    startTransition(async () => {
      try {
        const { studentName: name } = await executeErasure(dsrId)
        onDone(name)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erasure failed — check server logs')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Confirm data erasure" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border-b border-red-100">
          <Icon name="warning" size="md" color="text-red-600" />
          <div>
            <h2 className="text-[15px] font-semibold text-red-900">Execute erasure — irreversible</h2>
            <p className="text-[12px] text-red-700">This will permanently delete personal data for <strong>{studentName}</strong>.</p>
          </div>
          <button onClick={onClose} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="close" size="md" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[12px] font-semibold text-gray-700 mb-2">Data that will be permanently deleted:</p>
            <ul className="space-y-1">
              {DELETED_DATA.map(item => (
                <li key={item} className="flex items-start gap-2 text-[12px] text-gray-600">
                  <Icon name="delete_forever" size="sm" color="text-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-gray-700 mb-2">Data that will be retained (legal obligation):</p>
            <ul className="space-y-1">
              {RETAINED_DATA.map(item => (
                <li key={item} className="flex items-start gap-2 text-[12px] text-gray-500">
                  <Icon name="lock" size="sm" color="text-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-[12px] text-gray-600">
            This action cannot be undone. Before proceeding, ensure:
            <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
              <li>The request is valid and has been verified</li>
              <li>The 30-day response window has been observed</li>
              <li>Any exemptions (e.g. legal retention) have been considered</li>
            </ul>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Type <span className="font-mono bg-gray-100 px-1 rounded">CONFIRM</span> to enable the button
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirm(e.target.value)}
              placeholder="CONFIRM"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={!isReady || pending}
            className="px-4 py-2 text-[13px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Erasing data…' : 'Execute erasure'}
          </button>
        </div>
      </div>
    </div>
  )
}
