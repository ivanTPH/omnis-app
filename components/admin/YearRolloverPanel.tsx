'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

type Preview = { dryRun: true; promoted: number; graduated: number }
type Result  = { ok: true; promoted: number; graduated: number }

export default function YearRolloverPanel() {
  const [state,    setState]    = useState<'idle' | 'previewing' | 'confirming' | 'running' | 'done' | 'error'>('idle')
  const [preview,  setPreview]  = useState<Preview | null>(null)
  const [result,   setResult]   = useState<Result  | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handlePreview() {
    setState('previewing')
    try {
      const res  = await fetch('/api/admin/trigger-year-rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setPreview(data)
      setState('confirming')
    } catch (err) {
      setErrorMsg(String(err))
      setState('error')
    }
  }

  async function handleConfirm() {
    setState('running')
    try {
      const res  = await fetch('/api/admin/trigger-year-rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Rollover failed')
      setResult(data)
      setState('done')
    } catch (err) {
      setErrorMsg(String(err))
      setState('error')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Icon name="school" size="md" className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-gray-900">Year Group Rollover</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Promote all students up one year group. Year 13 students are marked as leavers.
            This runs automatically on 1 September — use this button to trigger manually if needed.
          </p>

          {state === 'idle' && (
            <button
              onClick={handlePreview}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
            >
              <Icon name="preview" size="sm" />
              Preview rollover
            </button>
          )}

          {state === 'previewing' && (
            <p className="mt-3 text-[12px] text-gray-400 flex items-center gap-1.5">
              <Icon name="refresh" size="sm" className="animate-spin" /> Calculating…
            </p>
          )}

          {state === 'confirming' && preview && (
            <div className="mt-3 space-y-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[12px] text-amber-800">
                <strong>{preview.promoted}</strong> students will be promoted &nbsp;|&nbsp;
                <strong>{preview.graduated}</strong> Year 13 students will be marked as leavers
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition"
                >
                  <Icon name="check_circle" size="sm" />
                  Confirm rollover
                </button>
                <button
                  onClick={() => setState('idle')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {state === 'running' && (
            <p className="mt-3 text-[12px] text-gray-400 flex items-center gap-1.5">
              <Icon name="refresh" size="sm" className="animate-spin" /> Running rollover…
            </p>
          )}

          {state === 'done' && result && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[12px] text-green-800 flex items-center gap-2">
              <Icon name="check_circle" size="sm" className="text-green-600" />
              Rollover complete — {result.promoted} promoted, {result.graduated} graduated
            </div>
          )}

          {state === 'error' && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700 flex items-center gap-2">
              <Icon name="error" size="sm" className="text-red-500" />
              {errorMsg}
              <button onClick={() => setState('idle')} className="ml-auto text-red-500 hover:text-red-700">
                <Icon name="close" size="sm" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
