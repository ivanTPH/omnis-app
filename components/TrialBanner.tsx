'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { getTrialStatus, type TrialStatus } from '@/app/actions/trial'

export default function TrialBanner() {
  const [trial, setTrial] = useState<TrialStatus | 'loading'>('loading')

  useEffect(() => {
    getTrialStatus().then(setTrial).catch(() => setTrial(null))
  }, [])

  // null = full account (no trial), 'loading' = not yet fetched
  if (trial === 'loading' || trial === null) return null

  // Active trial with > 7 days left — don't show banner
  if (trial.active && trial.daysLeft > 7) return null

  const expired = !trial.active

  return (
    <div
      className={`shrink-0 flex items-center gap-3 px-4 py-2 text-sm font-medium ${
        expired
          ? 'bg-red-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      <Icon name={expired ? 'lock' : 'timer'} size="sm" />
      <span className="flex-1">
        {expired
          ? 'Your 30-day trial has ended. Upgrade to continue using Omnis.'
          : `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left in your trial.`}
      </span>
      <Link
        href="/upgrade"
        className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          expired
            ? 'bg-white text-red-600 hover:bg-red-50'
            : 'bg-white text-amber-700 hover:bg-amber-50'
        }`}
      >
        {expired ? 'Upgrade now' : 'View plans'}
      </Link>
    </div>
  )
}
