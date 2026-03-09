import React from 'react'

type Props = {
  score: number
  size?: 'sm' | 'md'
}

function colour(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700'
  if (score >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function SendScoreBadge({ score, size = 'sm' }: Props) {
  const base = size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-[13px] px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1 rounded font-semibold ${base} ${colour(score)}`}>
      SEND {score}
    </span>
  )
}
