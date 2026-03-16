'use client'
import { useState } from 'react'
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Database,
  Users, BookOpen, UserCheck, Calendar, AlertTriangle,
  Wifi, WifiOff, ChevronDown, ChevronUp,
} from 'lucide-react'
import { triggerWondeSync, testWondeConnection } from '@/app/actions/wonde'
import type { WondeSyncLog } from '@prisma/client'

interface Props {
  config: {
    connected: boolean
    wondeSchoolId: string | null
    mis: string | null
    phase: string | null
    syncedAt: Date | null
    lastDeltaAt: Date | null
  } | null
  counts: {
    employees: number
    students: number
    classes: number
    groups: number
    periods: number
    timetable: number
  }
  logs: WondeSyncLog[]
}

function timeAgo(date: Date | null): string {
  if (!date) return 'Never'
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 60) return 'Just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    running: 'bg-blue-100 text-blue-700',
    failed:  'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function LogRow({ log }: { log: WondeSyncLog }) {
  const [open, setOpen] = useState(false)
  const errs = (log.errors as string[]) ?? []
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={log.status} />
          <span className="text-[13px] text-gray-700 font-medium capitalize">{log.syncType} sync</span>
          <span className="text-[12px] text-gray-400">{log.recordsProcessed} records</span>
          {errs.length > 0 && (
            <span className="text-[11px] text-amber-600 flex items-center gap-1">
              <AlertTriangle size={11} /> {errs.length} warning{errs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-gray-400">{timeAgo(log.startedAt)}</span>
          {log.completedAt && (
            <span className="text-[11px] text-gray-400">
              {((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000).toFixed(1)}s
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>
      {open && errs.length > 0 && (
        <div className="px-4 pb-3 space-y-1 bg-amber-50 border-t border-amber-100">
          {errs.map((e, i) => (
            <p key={i} className="text-[12px] text-amber-800 font-mono leading-relaxed">{e}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WondeSyncPanel({ config, counts, logs: initialLogs }: Props) {
  const [syncing,  setSyncing]  = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; schoolName?: string; mis?: string; error?: string } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    result?: {
      employees: { upserted: number }
      students:  { upserted: number }
      contacts:  { upserted: number }
      groups:    { upserted: number }
      classes:   { upserted: number }
      enrolments:{ upserted: number }
      periods:   { upserted: number }
      timetable: { upserted: number }
      errors:    string[]
      durationMs: number
    }
    error?: string
  } | null>(null)
  const [logs, setLogs] = useState(initialLogs)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testWondeConnection()
      setTestResult(r)
    } finally {
      setTesting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await triggerWondeSync()
      setSyncResult(r)
      if (r.success) {
        // Refresh page data (server will re-fetch counts + logs)
        window.location.reload()
      }
    } finally {
      setSyncing(false)
    }
  }

  const isConfigured = !!(config?.wondeSchoolId)

  return (
    <div className="space-y-6">

      {/* Connection card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {config?.connected
              ? <Wifi size={16} className="text-green-500" />
              : <WifiOff size={16} className="text-gray-400" />
            }
            <h2 className="text-[15px] font-semibold text-gray-900">MIS Connection</h2>
          </div>
          <div className="flex items-center gap-2">
            {config?.connected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                <CheckCircle2 size={10} /> Connected
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Wonde School ID</p>
            <p className="text-[13px] font-mono text-gray-700">{config?.wondeSchoolId ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">MIS Provider</p>
            <p className="text-[13px] text-gray-700">{config?.mis ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Phase</p>
            <p className="text-[13px] text-gray-700">{config?.phase ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Last Synced</p>
            <p className="text-[13px] text-gray-700">{timeAgo(config?.syncedAt ?? null)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={!isConfigured || testing}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Wifi size={14} />
            {testing ? 'Testing…' : 'Test Connection'}
          </button>

          <button
            onClick={handleSync}
            disabled={!isConfigured || syncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Run Full Sync'}
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-3 p-3 rounded-lg text-[13px] flex items-center gap-2 ${
            testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {testResult.ok
              ? <><CheckCircle2 size={14} /> Connected to <strong>{testResult.schoolName}</strong> ({testResult.mis})</>
              : <><XCircle size={14} /> {testResult.error}</>
            }
          </div>
        )}

        {/* Sync result */}
        {syncResult && (
          <div className={`mt-3 p-3 rounded-lg text-[13px] ${
            syncResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {syncResult.success && syncResult.result ? (
              <div>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <CheckCircle2 size={14} />
                  Sync complete in {(syncResult.result.durationMs / 1000).toFixed(1)}s
                </div>
                <div className="grid grid-cols-4 gap-2 text-[12px]">
                  <span>Staff: {syncResult.result.employees.upserted}</span>
                  <span>Students: {syncResult.result.students.upserted}</span>
                  <span>Classes: {syncResult.result.classes.upserted}</span>
                  <span>Timetable: {syncResult.result.timetable.upserted}</span>
                </div>
                {syncResult.result.errors.length > 0 && (
                  <p className="mt-2 text-amber-700 text-[12px]">
                    {syncResult.result.errors.length} partial error(s) — see logs below
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle size={14} /> {syncResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Staff',      value: counts.employees, icon: UserCheck },
          { label: 'Students',   value: counts.students,  icon: Users },
          { label: 'Classes',    value: counts.classes,   icon: BookOpen },
          { label: 'Groups',     value: counts.groups,    icon: Users },
          { label: 'Periods',    value: counts.periods,   icon: Clock },
          { label: 'Timetable',  value: counts.timetable, icon: Calendar },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <Icon size={16} className="text-indigo-400 mx-auto mb-1.5" />
            <p className="text-[20px] font-bold text-gray-900">{value.toLocaleString()}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sync logs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database size={15} className="text-gray-400" />
          Sync History
        </h2>
        {logs.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-8">No sync runs yet</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

    </div>
  )
}
