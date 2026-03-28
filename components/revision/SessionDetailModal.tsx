'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { markSessionComplete, skipSession } from '@/app/actions/revision'

type Session = {
  id:            string
  subject:       string
  topic:         string
  scheduledAt:   Date
  durationMins:  number
  status:        string
  confidence:    number | null
  notes:         string | null
  oakLessonSlug: string | null
  oakLessonTitle?: string | null
}

const SUBJECT_COLOURS: Record<string, string> = {
  'English':     'bg-purple-100 text-purple-700',
  'Maths':       'bg-blue-100 text-blue-700',
  'Science':     'bg-green-100 text-green-700',
  'Biology':     'bg-emerald-100 text-emerald-700',
  'Chemistry':   'bg-yellow-100 text-yellow-700',
  'Physics':     'bg-cyan-100 text-cyan-700',
  'History':     'bg-orange-100 text-orange-700',
  'Geography':   'bg-teal-100 text-teal-700',
  'French':      'bg-indigo-100 text-indigo-700',
  'Spanish':     'bg-pink-100 text-pink-700',
  'German':      'bg-rose-100 text-rose-700',
  'Art':         'bg-fuchsia-100 text-fuchsia-700',
  'Music':       'bg-violet-100 text-violet-700',
  'Drama':       'bg-amber-100 text-amber-700',
  'Computing':   'bg-sky-100 text-sky-700',
  'RE':          'bg-lime-100 text-lime-700',
  'PE':          'bg-red-100 text-red-700',
}

function subjectColour(subject: string) {
  return SUBJECT_COLOURS[subject] ?? 'bg-gray-100 text-gray-700'
}

function ConfidenceStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)}>
          <Icon
            name="star"
            size="md"
            className={n <= value ? 'text-amber-400' : 'text-gray-300'}
          />
        </button>
      ))}
      <span className="text-[11px] text-gray-500 ml-1">
        {value === 1 ? 'Not at all' : value === 2 ? 'Not confident' : value === 3 ? 'Okay' : value === 4 ? 'Confident' : 'Very confident'}
      </span>
    </div>
  )
}

export default function SessionDetailModal({
  session,
  onClose,
  onRefresh,
}: {
  session:   Session
  onClose:   () => void
  onRefresh: () => void
}) {
  const [pending,    start]          = useTransition()
  const [confidence, setConfidence]  = useState(3)
  const [notes,      setNotes]       = useState('')
  const [marking,    setMarking]     = useState(false)

  const statusColour =
    session.status === 'completed' ? 'bg-green-100 text-green-700'
    : session.status === 'skipped' ? 'bg-gray-100 text-gray-500'
    : 'bg-blue-100 text-blue-700'

  function handleComplete() {
    start(async () => {
      await markSessionComplete(session.id, confidence, notes || undefined)
      onRefresh()
      onClose()
    })
  }

  function handleSkip() {
    start(async () => {
      await skipSession(session.id)
      onRefresh()
      onClose()
    })
  }

  const scheduledDate = new Date(session.scheduledAt)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${subjectColour(session.subject)}`}>
                {session.subject}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColour}`}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </span>
            </div>
            <h3 className="text-[15px] font-bold text-gray-900">{session.topic}</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {scheduledDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}{scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{session.durationMins} min
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-3 shrink-0">
            <Icon name="close" size="md" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Oak Lesson link */}
          {session.oakLessonSlug && (
            <a
              href={`https://www.thenational.academy/teachers/lessons/${session.oakLessonSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12px] text-blue-600 hover:text-blue-700 font-medium"
            >
              <Icon name="open_in_new" size="sm" />
              {session.oakLessonTitle ?? 'View Oak Lesson'}
            </a>
          )}

          {/* Completed state */}
          {session.status === 'completed' && (
            <div className="space-y-2">
              {session.confidence != null && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">Confidence after session</p>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(n => (
                      <Icon key={n} name="star" size="sm"
                        className={n <= (session.confidence ?? 0) ? 'text-amber-400' : 'text-gray-200'}
                      />
                    ))}
                  </div>
                </div>
              )}
              {session.notes && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">Notes</p>
                  <p className="text-[12px] text-gray-700 bg-gray-50 rounded-lg p-2">{session.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Planned state — mark complete flow */}
          {session.status === 'planned' && !marking && (
            <div className="flex gap-2">
              <button
                onClick={() => setMarking(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700"
              >
                <Icon name="check_circle" size="sm" />
                Mark Complete
              </button>
              <button
                onClick={handleSkip}
                disabled={pending}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                <Icon name="skip_next" size="sm" />
                Skip
              </button>
            </div>
          )}

          {session.status === 'planned' && marking && (
            <div className="space-y-3">
              <div>
                <p className="text-[12px] font-semibold text-gray-700 mb-2">How confident do you feel now?</p>
                <ConfidenceStars value={confidence} onChange={setConfidence} />
              </div>
              <textarea
                className="w-full text-[12px] p-2.5 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                rows={2}
                placeholder="Any notes on what you covered? (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleComplete}
                  disabled={pending}
                  className="flex-1 py-2.5 text-[13px] font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save & Complete'}
                </button>
                <button
                  onClick={() => setMarking(false)}
                  className="px-4 py-2.5 text-[13px] text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
