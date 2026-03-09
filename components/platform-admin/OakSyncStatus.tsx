'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { triggerDeltaSync } from '@/app/actions/platform-admin'

// ─── Types mirrored from Prisma (no import to keep client bundle clean) ───────

type SyncLog = {
  id:              string
  type:            string
  status:          string
  startedAt:       Date
  completedAt:     Date | null
  durationMs:      number | null
  newSubjects:     number
  updatedSubjects: number
  deletedSubjects: number
  newUnits:        number
  updatedUnits:    number
  deletedUnits:    number
  newLessons:      number
  updatedLessons:  number
  deletedLessons:  number
  errorCount:      number
  errors:          { slug: string; message: string }[]
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { colour: string; icon: React.ReactNode }> = {
    running:   { colour: 'bg-blue-100 text-blue-700',   icon: <Loader2 size={10} className="animate-spin" /> },
    completed: { colour: 'bg-green-100 text-green-700', icon: <CheckCircle size={10} /> },
    partial:   { colour: 'bg-amber-100 text-amber-700', icon: <AlertCircle size={10} /> },
    failed:    { colour: 'bg-red-100 text-red-700',     icon: <XCircle size={10} /> },
  }
  const { colour, icon } = map[status] ?? map.partial
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${colour}`}>
      {icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Single log row ───────────────────────────────────────────────────────────

function SyncLogRow({ log }: { log: SyncLog }) {
  const [open, setOpen] = useState(false)
  const errors = Array.isArray(log.errors) ? (log.errors as { slug: string; message: string }[]) : []

  const durationSec = log.durationMs ? (log.durationMs / 1000).toFixed(1) : '—'
  const started     = new Date(log.startedAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-36 shrink-0">
          <p className="text-[12px] text-gray-700 font-medium">{started}</p>
        </div>
        <div className="w-16 shrink-0">
          <span className="text-[11px] text-gray-500 uppercase">{log.type}</span>
        </div>
        <div className="w-24 shrink-0">
          <StatusBadge status={log.status} />
        </div>
        <div className="w-12 shrink-0 text-[11px] text-gray-500 text-right">{durationSec}s</div>
        <div className="flex-1 flex items-center gap-3 text-[11px] text-gray-500">
          <span className="text-green-600">+{log.newLessons} lessons</span>
          {log.updatedLessons > 0 && <span className="text-blue-600">~{log.updatedLessons}</span>}
          {log.deletedLessons > 0 && <span className="text-red-500">-{log.deletedLessons}</span>}
          {log.errorCount > 0 && <span className="text-red-600 font-semibold">{log.errorCount} errors</span>}
        </div>
        <div className="shrink-0 text-gray-300">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-[11px] mb-3">
            {[
              { label: 'Subjects', n: log.newSubjects, u: log.updatedSubjects, d: log.deletedSubjects },
              { label: 'Units',    n: log.newUnits,    u: log.updatedUnits,    d: log.deletedUnits    },
              { label: 'Lessons',  n: log.newLessons,  u: log.updatedLessons,  d: log.deletedLessons  },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <p className="font-semibold text-gray-600 mb-1">{s.label}</p>
                <p className="text-green-600">+{s.n} new</p>
                <p className="text-blue-600">~{s.u} updated</p>
                <p className="text-red-500">-{s.d} deleted</p>
              </div>
            ))}
          </div>
          {errors.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-auto">
              {errors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-600 font-mono truncate">
                  [{e.slug}] {e.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = { logs: SyncLog[] }

export default function OakSyncStatus({ logs: initialLogs }: Props) {
  const [logs,     setLogs]     = useState<SyncLog[]>(initialLogs)
  const [result,   setResult]   = useState<string | null>(null)
  const [pending,  start]       = useTransition()

  function handleTrigger() {
    setResult(null)
    start(async () => {
      const res = await triggerDeltaSync()
      if (res.success) {
        setResult(`Sync completed in ${(res.durationMs / 1000).toFixed(1)}s. New lessons: ${res.counts?.newLessons ?? 0}.`)
      } else {
        setResult(`Sync failed: ${res.error}`)
      }
      // Refresh logs from server — re-fetch via browser reload for simplicity
      // (full refetch would require a server action; page refresh is fine here)
      setTimeout(() => window.location.reload(), 2000)
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-bold text-gray-900">Oak Content Sync</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Weekly delta sync runs every Sunday at 2am via Vercel Cron.
          </p>
        </div>
        <button
          onClick={handleTrigger}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={pending ? 'animate-spin' : ''} />
          {pending ? 'Running…' : 'Run Delta Sync Now'}
        </button>
      </div>

      {result && (
        <p className={`mb-4 text-[12px] px-3 py-2 rounded-lg ${
          result.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {result}
        </p>
      )}

      {/* Log table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="w-36 shrink-0 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Started</div>
          <div className="w-16 shrink-0 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</div>
          <div className="w-24 shrink-0 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</div>
          <div className="w-12 shrink-0 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Time</div>
          <div className="flex-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Changes</div>
        </div>

        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[12px] text-gray-400">No sync logs yet. Run the first delta sync above.</p>
          </div>
        ) : (
          logs.map(log => <SyncLogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  )
}
