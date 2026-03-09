'use client'

import { useState, useEffect, useTransition } from 'react'
import { getFeatureFlags, setFeatureFlag } from '@/app/actions/platform-admin'
import type { FeatureFlagRow } from '@/app/actions/platform-admin'

const KNOWN_FLAGS: { flag: string; label: string; description: string }[] = [
  { flag: 'send_scorer',   label: 'SEND Resource Scorer', description: 'AI-powered SEND accessibility scoring for Oak lessons'         },
  { flag: 'oak_resources', label: 'Oak Resources',        description: 'Access to Oak National Academy lesson library'                   },
  { flag: 'gdpr_portal',   label: 'GDPR Portal',          description: 'Parent-facing consent management and DSR tracking'              },
  { flag: 'parent_portal', label: 'Parent Portal',        description: 'Parent dashboard, progress view and messaging'                  },
  { flag: 'wonde_sync',    label: 'Wonde MIS Sync',       description: 'Live sync with Wonde MIS for staff, students and timetables'    },
]

type Props = { schoolId: string }

export default function FeatureFlagPanel({ schoolId }: Props) {
  const [flags,      setFlags]     = useState<FeatureFlagRow[]>([])
  const [loading,    setLoading]   = useState(true)
  const [togglingFlag, setToggling] = useState<string | null>(null)
  const [pending, start]           = useTransition()

  useEffect(() => {
    getFeatureFlags(schoolId).then(f => { setFlags(f); setLoading(false) })
  }, [schoolId])

  function getEnabled(flag: string): boolean {
    return flags.find(f => f.flag === flag)?.enabled ?? false
  }

  function handleToggle(flag: string, current: boolean) {
    setToggling(flag)
    // Optimistic
    setFlags(prev => {
      const existing = prev.find(f => f.flag === flag)
      if (existing) return prev.map(f => f.flag === flag ? { ...f, enabled: !current } : f)
      return [...prev, { id: '', flag, enabled: !current, setAt: new Date() }]
    })
    start(async () => {
      await setFeatureFlag(schoolId, flag, !current)
      setToggling(null)
    })
  }

  if (loading) {
    return <div className="py-4 text-center text-[12px] text-gray-400">Loading flags…</div>
  }

  return (
    <div className="space-y-2 py-3">
      {KNOWN_FLAGS.map(({ flag, label, description }) => {
        const enabled    = getEnabled(flag)
        const isToggling = pending && togglingFlag === flag
        return (
          <div key={flag} className="flex items-start gap-3 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-700">{label}</p>
              <p className="text-[11px] text-gray-400">{description}</p>
            </div>
            <button
              onClick={() => handleToggle(flag, enabled)}
              disabled={isToggling}
              className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-200'}`}
              aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
