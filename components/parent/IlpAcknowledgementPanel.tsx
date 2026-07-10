'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { acknowledgeIlp } from '@/app/actions/ilp-parent'

type Target = { id: string; target: string; successMeasure: string | null }

type Props = {
  ilpId:            string
  targets:          Target[]
  sendCategory:     string
  acknowledged:     boolean
  reviewedAt:       Date | null
  meetingRequested: boolean
}

export default function IlpAcknowledgementPanel({
  ilpId, targets, sendCategory,
  acknowledged: initialAck, reviewedAt: initialDate, meetingRequested: initialMtg,
}: Props) {
  const [acknowledged,     setAcknowledged]    = useState(initialAck)
  const [reviewedAt,       setReviewedAt]      = useState<Date | null>(initialDate)
  const [meetingRequested, setMeetingRequested] = useState(initialMtg)
  const [showForm,         setShowForm]        = useState(false)
  const [homeProgress,     setHomeProgress]    = useState('')
  const [wantMeeting,      setWantMeeting]     = useState(false)
  const [meetingNote,      setMeetingNote]     = useState('')
  const [saving,           setSaving]          = useState(false)
  const [saved,            setSaved]           = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      await acknowledgeIlp(ilpId, homeProgress, wantMeeting, meetingNote)
      setAcknowledged(true)
      setReviewedAt(new Date())
      if (wantMeeting) setMeetingRequested(true)
      setSaved(true)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const dateStr = reviewedAt
    ? new Date(reviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mt-2 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Icon name="flag" size="sm" className="text-indigo-600" />
            <span className="text-[13px] font-semibold text-indigo-900">Individual Learning Plan</span>
            <span className="text-[11px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
              {targets.length} active goal{targets.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-indigo-500">{sendCategory}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {acknowledged && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              <Icon name="check_circle" size="sm" />
              Reviewed{dateStr ? ` · ${dateStr}` : ''}
            </span>
          )}
          {meetingRequested && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              <Icon name="event" size="sm" />
              Meeting requested
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {targets.slice(0, 4).map(t => (
          <div key={t.id} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="flag" size="sm" className="text-indigo-700" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-indigo-900">{t.target}</p>
              {t.successMeasure && (
                <p className="text-[11px] text-indigo-500 mt-0.5">Success: {t.successMeasure}</p>
              )}
            </div>
          </div>
        ))}
        {targets.length > 4 && (
          <p className="text-[11px] text-indigo-400 pl-8">+{targets.length - 4} more goals</p>
        )}
      </div>

      {!showForm && !saved && (
        <div className="border-t border-indigo-100 pt-3">
          <p className="text-[11px] text-indigo-600 mb-2">
            {acknowledged
              ? 'Add a home progress update or request a meeting with the SENCO.'
              : 'Please confirm you have reviewed your child&apos;s learning goals.'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition"
          >
            <Icon name="check" size="sm" />
            {acknowledged ? 'Add update / request meeting' : 'I have reviewed these goals'}
          </button>
        </div>
      )}

      {saved && (
        <div className="border-t border-emerald-100 pt-3 flex items-center gap-2 text-[12px] text-emerald-700">
          <Icon name="check_circle" size="sm" />
          {wantMeeting
            ? 'Thank you — your SENCO has been notified of your meeting request.'
            : 'Thank you for acknowledging your child&apos;s learning plan.'}
        </div>
      )}

      {showForm && (
        <div className="border-t border-indigo-100 pt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-indigo-700 mb-1">
              How is your child progressing at home? <span className="font-normal text-indigo-400">(optional)</span>
            </label>
            <textarea
              value={homeProgress}
              onChange={e => setHomeProgress(e.target.value)}
              rows={3}
              placeholder="e.g. They are practising reading 15 minutes each evening and seem more confident..."
              className="w-full text-[12px] border border-indigo-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={wantMeeting} onChange={e => setWantMeeting(e.target.checked)} className="mt-0.5" />
            <span className="text-[12px] text-indigo-800">I would like to request a meeting with the SENCO to discuss this plan</span>
          </label>
          {wantMeeting && (
            <textarea
              value={meetingNote}
              onChange={e => setMeetingNote(e.target.value)}
              rows={2}
              placeholder="Anything specific you would like to discuss? (optional)"
              className="w-full text-[12px] border border-indigo-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="check" size="sm" />}
              {saving ? 'Saving…' : 'Submit'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[12px] text-indigo-500 hover:text-indigo-700 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
