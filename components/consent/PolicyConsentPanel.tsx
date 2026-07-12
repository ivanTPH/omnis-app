'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export type ConsentItem = {
  id: string
  /** Short, plain-English label shown next to the checkbox */
  label: string
  /** Title shown in the policy modal */
  policyTitle: string
  /** Full policy content rendered inside the modal */
  policyContent: React.ReactNode
  /** Default: true. Set false for optional/preference items */
  required?: boolean
}

type Props = {
  items: ConsentItem[]
  checked: Record<string, boolean>
  onChange: (id: string, val: boolean) => void
  /** Set true after a submit attempt to reveal per-item validation errors */
  attempted: boolean
}

/**
 * Industry-standard consent panel: one checkbox per policy, each with a
 * "View full policy" link that opens an inline modal. Required items show a
 * validation error when `attempted` is true and the box is unchecked.
 *
 * The "I have read this — Accept" button inside the modal ticks the box and
 * closes the modal automatically, matching the flow users expect from SaaS
 * onboarding and Gov.UK service patterns.
 */
export default function PolicyConsentPanel({ items, checked, onChange, attempted }: Props) {
  const [viewing, setViewing] = useState<ConsentItem | null>(null)

  return (
    <>
      <div className="space-y-3">
        {items.map(item => {
          const isRequired = item.required !== false
          const isChecked  = !!checked[item.id]
          const showError  = attempted && isRequired && !isChecked

          return (
            <div
              key={item.id}
              className={`border rounded-xl p-4 transition-colors ${
                showError
                  ? 'border-rose-300 bg-rose-50'
                  : isChecked
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`consent-${item.id}`}
                  checked={isChecked}
                  onChange={e => onChange(item.id, e.target.checked)}
                  aria-describedby={showError ? `consent-error-${item.id}` : undefined}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={`consent-${item.id}`}
                    className="text-[13px] text-gray-700 cursor-pointer leading-relaxed block"
                  >
                    {item.label}
                  </label>
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    className="text-[12px] text-indigo-600 hover:text-indigo-800 underline mt-1 text-left"
                  >
                    View full policy →
                  </button>
                </div>
                {isChecked && (
                  <Icon name="check_circle" size="sm" className="text-green-600 shrink-0 mt-0.5" />
                )}
              </div>
              {showError && (
                <p
                  id={`consent-error-${item.id}`}
                  className="text-[11px] text-rose-600 font-medium mt-2 pl-8 flex items-center gap-1"
                >
                  <Icon name="error" size="sm" />
                  You must accept this to continue
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Full-policy modal ─────────────────────────────────────────────────── */}
      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl"
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-gray-100 shrink-0 flex items-center justify-between gap-3">
              <h3 id="policy-modal-title" className="text-base font-semibold text-gray-900">
                {viewing.policyTitle}
              </h3>
              <button
                type="button"
                aria-label="Close policy"
                onClick={() => setViewing(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors shrink-0"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            {/* Body — scrollable policy text */}
            <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1 text-sm text-gray-700 space-y-4 leading-relaxed">
              {viewing.policyContent}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-[11px] text-gray-400">
                Tick the checkbox to confirm you have read and accept this policy.
              </p>
              <button
                type="button"
                onClick={() => {
                  onChange(viewing.id, true)
                  setViewing(null)
                }}
                className="shrink-0 px-4 py-2 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <Icon name="check_circle" size="sm" />
                I have read this — Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
