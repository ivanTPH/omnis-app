'use client'

import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { getExistingScore, getOrCreateSendScore } from '@/app/actions/send-scorer'
import type { SendQualityScoreData } from '@/app/actions/send-scorer'
import SendScoreBadge from './SendScoreBadge'
import SendScoreCard from './SendScoreCard'

type Props = {
  oakLessonSlug: string
  canRescore?: boolean
}

export default function SendScoreButton({ oakLessonSlug, canRescore = false }: Props) {
  const [score, setScore]       = useState<SendQualityScoreData | null>(null)
  const [open, setOpen]         = useState(false)
  const [checked, setChecked]   = useState(false)
  const [pending, startTransition] = useTransition()

  // On mount: check if a cached score already exists (cheap read)
  useEffect(() => {
    getExistingScore(oakLessonSlug).then(s => {
      setScore(s)
      setChecked(true)
    })
  }, [oakLessonSlug])

  function handleScore() {
    if (score) {
      setOpen(o => !o)
      return
    }
    startTransition(async () => {
      const s = await getOrCreateSendScore(oakLessonSlug)
      setScore(s)
      setOpen(true)
    })
  }

  if (!checked) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleScore}
          disabled={pending}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-[11px] font-semibold transition-colors disabled:opacity-50"
        >
          {pending
            ? <><Icon name="refresh" size="sm" className="animate-spin" />Scoring…</>
            : <><Icon name="auto_awesome" size="sm" />{score ? 'SEND Score' : 'Score for SEND'}</>}
        </button>
        {score && !open && <SendScoreBadge score={score.overallScore} />}
      </div>

      {open && score && (
        <SendScoreCard
          score={score}
          canRescore={canRescore}
          onRescore={s => setScore(s)}
        />
      )}
    </div>
  )
}
