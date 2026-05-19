'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { sendSencoAlert } from '@/app/actions/dashboard'

const TEACHER_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT']

type Props = {
  studentId:   string
  studentName: string
  staffList:   { id: string; name: string; role: string }[]
  onClose:     () => void
}

export default function SencoAlertModal({ studentId, studentName, staffList, onClose }: Props) {
  const teachers = staffList.filter(s => TEACHER_ROLES.includes(s.role))

  const [message,     setMessage]     = useState('')
  const [selected,    setSelected]    = useState<Set<string>>(new Set(teachers.map(t => t.id)))
  const [sent,        setSent]        = useState<number | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()

  function toggleAll() {
    setSelected(prev =>
      prev.size === teachers.length ? new Set() : new Set(teachers.map(t => t.id))
    )
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSend() {
    if (!message.trim() || selected.size === 0) return
    setError(null)
    startTransition(async () => {
      try {
        const { notified } = await sendSencoAlert(
          studentId,
          studentName,
          message.trim(),
          Array.from(selected),
        )
        setSent(notified)
      } catch {
        setError('Failed to send alert. Please try again.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="notification_important" size="sm" className="text-amber-600" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-900">Send SENCO Alert</p>
              <p className="text-[11px] text-gray-500">{studentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Icon name="close" size="md" />
          </button>
        </div>

        {sent !== null ? (
          /* Success state */
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="check_circle" size="lg" className="text-green-600" />
            </div>
            <p className="text-[15px] font-semibold text-gray-900">Alert sent</p>
            <p className="text-sm text-gray-500">
              {sent} staff member{sent !== 1 ? 's' : ''} will see this alert on their dashboard.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Message */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder={`e.g. "${studentName} is finding extended writing difficult — please allow extra time and consider breaking tasks into smaller steps."`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-[10px] text-gray-400 text-right mt-0.5">{message.length}/500</p>
              </div>

              {/* Teacher selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Notify staff ({selected.size}/{teachers.length})
                  </label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selected.size === teachers.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {teachers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-gray-400 italic">No staff found.</p>
                  ) : (
                    teachers.map(t => (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-400"
                        />
                        <span className="flex-1 text-sm text-gray-800">{t.name}</span>
                        <span className="text-[10px] text-gray-400">{t.role.replace(/_/g, ' ')}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!message.trim() || selected.size === 0 || isPending}
                className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending
                  ? <Icon name="refresh" size="sm" className="animate-spin" />
                  : <Icon name="send" size="sm" />
                }
                Send alert to {selected.size} staff
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
