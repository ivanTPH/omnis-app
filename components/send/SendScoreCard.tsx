'use client'

import React, { useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import type { SendQualityScoreData } from '@/app/actions/send-scorer'
import { forceRescoreLesson } from '@/app/actions/send-scorer'
import SendScoreBadge from './SendScoreBadge'

type Props = {
  score: SendQualityScoreData
  onRescore?: (s: SendQualityScoreData) => void
  canRescore?: boolean
}

const DIMENSIONS: { key: keyof SendQualityScoreData; label: string }[] = [
  { key: 'readabilityScore', label: 'Readability'  },
  { key: 'visualLoadScore',  label: 'Visual Load'  },
  { key: 'cognitiveScore',   label: 'Cognitive'    },
  { key: 'languageScore',    label: 'Language'     },
  { key: 'structureScore',   label: 'Structure'    },
]

function barColour(v: number) {
  if (v >= 70) return 'bg-green-500'
  if (v >= 40) return 'bg-amber-400'
  return 'bg-red-500'
}

export default function SendScoreCard({ score, onRescore, canRescore = false }: Props) {
  const [pending, startTransition] = useTransition()

  function handleRescore() {
    startTransition(async () => {
      const updated = await forceRescoreLesson(score.oakLessonSlug)
      onRescore?.(updated)
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-gray-700">SEND Quality Score</span>
          <SendScoreBadge score={score.overallScore} size="md" />
        </div>
        {canRescore && (
          <button
            onClick={handleRescore}
            disabled={pending}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <Icon name="refresh" size="sm" className={pending ? 'animate-spin' : ''} />
            Re-score
          </button>
        )}
      </div>

      {/* Dimension bars */}
      <div className="space-y-2.5">
        {DIMENSIONS.map(({ key, label }) => {
          const v = score[key] as number
          return (
            <div key={key}>
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>{label}</span>
                <span className="font-medium">{v}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColour(v)}`}
                  style={{ width: `${v}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <p className="text-[12px] text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
        {score.summary}
      </p>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommendations</p>
          <ul className="space-y-1.5">
            {score.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-gray-600">
                <span className="shrink-0 text-blue-500 font-bold">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-gray-300">
        Scored {new Date(score.scoredAt).toLocaleDateString('en-GB')} · {score.modelVersion}
      </p>
    </div>
  )
}
