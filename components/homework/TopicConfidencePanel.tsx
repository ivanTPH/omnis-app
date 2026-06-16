'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { saveTopicConfidence } from '@/app/actions/student'

const LABELS = ['Not confident', 'Slightly confident', 'Fairly confident', 'Confident', 'Very confident']
const COLORS  = [
  'text-rose-600 border-rose-300 bg-rose-50',
  'text-amber-600 border-amber-300 bg-amber-50',
  'text-yellow-600 border-yellow-200 bg-yellow-50',
  'text-blue-600 border-blue-300 bg-blue-50',
  'text-emerald-600 border-emerald-300 bg-emerald-50',
]

export default function TopicConfidencePanel({
  homeworkId,
  topic,
}: {
  homeworkId: string
  topic:      string
}) {
  const [selected, setSelected]   = useState<number | null>(null)
  const [saved,    setSaved]      = useState(false)
  const [error,    setError]      = useState<string | null>(null)
  const [, startTransition]       = useTransition()

  function handleSelect(star: number) {
    if (saved) return
    setSelected(star)
    setError(null)
    startTransition(async () => {
      const res = await saveTopicConfidence(homeworkId, star)
      if ('error' in res) {
        setError(res.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="psychology" size="sm" className="text-indigo-600" />
        <p className="text-[13px] font-semibold text-indigo-800">
          How confident do you feel about <span className="italic">{topic}</span>?
        </p>
      </div>

      {saved ? (
        <div className="flex items-center gap-2 text-emerald-700">
          <Icon name="check_circle" size="sm" />
          <p className="text-[12px] font-semibold">
            Saved — {selected != null ? LABELS[selected - 1] : ''}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => handleSelect(star)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                  selected === star
                    ? COLORS[star - 1]
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon name="star" size="sm" />
                {star}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-indigo-600 mt-2">
            {selected != null ? LABELS[selected - 1] : '1 = not confident · 5 = very confident'}
          </p>
          {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
        </>
      )}
    </div>
  )
}
