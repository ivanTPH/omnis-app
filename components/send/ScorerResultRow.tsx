'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { getOrCreateSendScore } from '@/app/actions/send-scorer'
import type { LessonWithScore, SendQualityScoreData } from '@/app/actions/send-scorer'
import SendScoreBadge from './SendScoreBadge'
import SendScoreCard from './SendScoreCard'

type Props = {
  lesson: LessonWithScore
  canRescore: boolean
}

export default function ScorerResultRow({ lesson, canRescore }: Props) {
  const [score, setScore]   = useState<SendQualityScoreData | null>(lesson.sendQualityScore)
  const [open, setOpen]     = useState(false)
  const [pending, start]    = useTransition()

  function handleScore() {
    if (score) { setOpen(o => !o); return }
    start(async () => {
      const s = await getOrCreateSendScore(lesson.slug)
      setScore(s)
      setOpen(true)
    })
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-white">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-800 leading-tight truncate">{lesson.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {lesson.subjectSlug} · {lesson.keystage}{lesson.yearGroup ? ` · Y${lesson.yearGroup}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {score && <SendScoreBadge score={score.overallScore} size="sm" />}
          <button
            onClick={handleScore}
            disabled={pending}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Icon name="refresh" size="sm" className="animate-spin" />
            ) : score ? (
              open ? <Icon name="expand_less" size="sm" /> : <Icon name="expand_more" size="sm" />
            ) : (
              <><Icon name="auto_awesome" size="sm" /> Score</>
            )}
          </button>
        </div>
      </div>

      {open && score && (
        <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
          <SendScoreCard
            score={score}
            canRescore={canRescore}
            onRescore={s => setScore(s)}
          />
        </div>
      )}
    </div>
  )
}
