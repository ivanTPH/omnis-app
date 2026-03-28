'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import type { ChildConsentData } from '@/app/actions/gdpr'
import { recordConsent } from '@/app/actions/gdpr'

const BASIS_LABELS: Record<string, string> = {
  consent:             'Consent required',
  legitimate_interest: 'Legitimate interest',
  legal_obligation:    'Legal obligation',
}

type Props = {
  consents: ChildConsentData[]
}

type LocalDecision = Record<string, string | null> // purposeId → decision

export default function ParentConsentPortal({ consents: childList }: Props) {
  // Track optimistic decisions per student+purpose
  const [decisions, setDecisions] = useState<Record<string, LocalDecision>>(() => {
    const map: Record<string, LocalDecision> = {}
    for (const child of childList) {
      map[child.studentId] = {}
      for (const p of child.purposes) {
        map[child.studentId][p.purposeId] = p.latestDecision
      }
    }
    return map
  })

  const [pending,    startTransition] = useTransition()
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  function handleToggle(studentId: string, purposeId: string, currentDecision: string | null) {
    const newDecision = currentDecision === 'granted' ? 'withdrawn' : 'granted'
    const key = `${studentId}:${purposeId}`
    setTogglingKey(key)
    // Optimistic update
    setDecisions(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [purposeId]: newDecision },
    }))
    startTransition(async () => {
      try {
        await recordConsent(purposeId, studentId, newDecision)
      } catch {
        // Revert on error
        setDecisions(prev => ({
          ...prev,
          [studentId]: { ...prev[studentId], [purposeId]: currentDecision },
        }))
      } finally {
        setTogglingKey(null)
      }
    })
  }

  if (childList.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-[13px] border border-dashed border-gray-200 rounded-xl">
        No children linked to your account. Please contact the school.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Icon name="verified_user" size="sm" className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-[12px] text-blue-700 leading-relaxed">
          <p className="font-semibold mb-0.5">Your data rights</p>
          <p>You can grant or withdraw consent at any time. Where processing is based on legitimate interest or legal obligation, it does not require your consent but is listed here for transparency. You have the right to access, correct, or request erasure of your child&apos;s personal data at any time.</p>
        </div>
      </div>

      {childList.map(child => (
        <div key={child.studentId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Child header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-blue-700 font-bold text-[13px]">
                  {child.firstName[0]}{child.lastName[0]}
                </span>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                {child.yearGroup && <p className="text-[12px] text-gray-400">Year {child.yearGroup}</p>}
              </div>
            </div>
          </div>

          {/* Purposes */}
          <div className="divide-y divide-gray-50">
            {child.purposes.map(p => {
              const currentDecision = decisions[child.studentId]?.[p.purposeId] ?? null
              const isGranted  = currentDecision === 'granted'
              const key        = `${child.studentId}:${p.purposeId}`
              const isToggling = pending && togglingKey === key
              const needsConsent = p.lawfulBasis === 'consent'

              return (
                <div key={p.purposeId} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[13px] font-semibold text-gray-800">{p.title}</p>
                        <span className="text-[10px] text-gray-400">{BASIS_LABELS[p.lawfulBasis] ?? p.lawfulBasis}</span>
                      </div>
                      <p className="text-[12px] text-gray-500 leading-relaxed">{p.description}</p>
                      {currentDecision && (
                        <p className="text-[11px] text-gray-300 mt-1.5">
                          Last updated:{' '}
                          {child.purposes.find(x => x.purposeId === p.purposeId)?.decidedAt
                            ? new Date(child.purposes.find(x => x.purposeId === p.purposeId)!.decidedAt!).toLocaleDateString('en-GB')
                            : 'just now'}
                        </p>
                      )}
                    </div>

                    {/* Toggle — only for consent-based purposes */}
                    {needsConsent ? (
                      <button
                        onClick={() => handleToggle(child.studentId, p.purposeId, currentDecision)}
                        disabled={isToggling}
                        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                          isGranted ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                        aria-label={isGranted ? 'Withdraw consent' : 'Grant consent'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            isGranted ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <div className="shrink-0 flex items-center gap-1 text-[11px] text-gray-400">
                        <Icon name="info" size="sm" />
                        Not applicable
                      </div>
                    )}
                  </div>

                  {/* Decision status */}
                  {needsConsent && (
                    <div className="mt-2">
                      {currentDecision === 'granted' && (
                        <span className="text-[11px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Consent granted</span>
                      )}
                      {currentDecision === 'withdrawn' && (
                        <span className="text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Consent withdrawn</span>
                      )}
                      {!currentDecision && (
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">No decision recorded</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
