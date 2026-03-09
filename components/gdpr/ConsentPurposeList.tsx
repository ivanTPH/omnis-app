'use client'

import { useState, useTransition } from 'react'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import type { ConsentPurposeData } from '@/app/actions/gdpr'
import { togglePurposeActive } from '@/app/actions/gdpr'
import ConsentPurposeForm from './ConsentPurposeForm'

const BASIS_LABELS: Record<string, { label: string; colour: string }> = {
  consent:             { label: 'Consent',              colour: 'bg-blue-100 text-blue-700'   },
  legitimate_interest: { label: 'Legitimate Interest',  colour: 'bg-amber-100 text-amber-700' },
  legal_obligation:    { label: 'Legal Obligation',     colour: 'bg-purple-100 text-purple-700' },
}

type Props = {
  purposes: ConsentPurposeData[]
  schoolId: string
}

export default function ConsentPurposeList({ purposes, schoolId }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [pending, start]        = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function handleToggle(id: string) {
    setTogglingId(id)
    start(async () => {
      await togglePurposeActive(id)
      setTogglingId(null)
    })
  }

  return (
    <div className="space-y-3">
      {purposes.map(p => {
        const basis = BASIS_LABELS[p.lawfulBasis] ?? { label: p.lawfulBasis, colour: 'bg-gray-100 text-gray-600' }
        return (
          <div
            key={p.id}
            className={`bg-white border rounded-xl p-4 transition-opacity ${!p.isActive ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[14px] font-semibold text-gray-900">{p.title}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${basis.colour}`}>
                    {basis.label}
                  </span>
                  {!p.isActive && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed">{p.description}</p>
                <p className="text-[11px] text-gray-300 mt-1.5 font-mono">{p.slug} · {p.recordCount} record{p.recordCount !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => handleToggle(p.id)}
                disabled={pending && togglingId === p.id}
                className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                title={p.isActive ? 'Deactivate' : 'Activate'}
              >
                {p.isActive
                  ? <ToggleRight size={22} className="text-green-500" />
                  : <ToggleLeft size={22} />}
              </button>
            </div>
          </div>
        )
      })}

      {purposes.length === 0 && !showForm && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400 text-[13px]">
          No consent purposes configured yet.
        </div>
      )}

      {showForm
        ? <ConsentPurposeForm schoolId={schoolId} onDone={() => setShowForm(false)} />
        : (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            <Plus size={14} /> Add Purpose
          </button>
        )}
    </div>
  )
}
