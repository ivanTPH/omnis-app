'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { EarlyWarningFlagRow } from '@/app/actions/send-support'
import { actionFlag, triggerEarlyWarningAnalysis } from '@/app/actions/send-support'

const FLAG_TYPE_LABELS: Record<string, string> = {
  completion_drop:   'Completion Drop',
  score_decline:     'Score Decline',
  multiple_concerns: 'Multiple Concerns',
  pattern_absence:   'Missed Homeworks',
  homework_decline:  'Homework Decline',
}

const SEVERITY_COLOURS: Record<string, string> = {
  low:    'bg-yellow-100 text-yellow-800',
  medium: 'bg-orange-100 text-orange-800',
  high:   'bg-red-100 text-red-800',
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${SEVERITY_COLOURS[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  )
}

type Props = { flags: EarlyWarningFlagRow[]; compact?: boolean }

export default function EarlyWarningPanel({ flags: initialFlags, compact }: Props) {
  const [flags,   setFlags]   = useState(initialFlags)
  const [running, setRunning] = useState(false)
  const [result,  setResult]  = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)

  const high   = flags.filter(f => f.severity === 'high')
  const medium = flags.filter(f => f.severity === 'medium')
  const low    = flags.filter(f => f.severity === 'low')

  async function runAnalysis() {
    setRunning(true)
    setResult(null)
    try {
      const r = await triggerEarlyWarningAnalysis()
      setResult(`${r.flagsCreated} new flag${r.flagsCreated !== 1 ? 's' : ''} detected.`)
    } catch {
      setResult('Analysis failed.')
    } finally {
      setRunning(false)
    }
  }

  async function handleAction(flagId: string) {
    setActioning(flagId)
    try {
      await actionFlag(flagId, 'Actioned by SENCO')
      setFlags(prev => prev.filter(f => f.id !== flagId))
    } finally {
      setActioning(null)
    }
  }

  function FlagGroup({ label, groupFlags }: { label: string; groupFlags: EarlyWarningFlagRow[] }) {
    if (groupFlags.length === 0) return null
    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h3>
        <div className="space-y-2">
          {groupFlags.map(f => (
            <div key={f.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Link
                      href={`/student/${f.studentId}/send`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {f.studentName}
                    </Link>
                    <SeverityBadge severity={f.severity} />
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {FLAG_TYPE_LABELS[f.flagType] ?? f.flagType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{f.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Detected {new Date(f.createdAt).toLocaleDateString('en-GB')} · expires {new Date(f.expiresAt).toLocaleDateString('en-GB')}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <Link
                      href={`/student/${f.studentId}/send`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Icon name="person_search" size="sm" /> View SEND record
                    </Link>
                    <Link
                      href={`/analytics?student=${f.studentId}`}
                      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      <Icon name="bar_chart" size="sm" /> Homework &amp; scores
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => handleAction(f.id)}
                  disabled={actioning === f.id}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50"
                >
                  <Icon name="check_circle" size="sm" />
                  {actioning === f.id ? 'Saving…' : 'Action'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header — hidden in compact mode */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="radar" size="md" className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Early Warning Flags</h2>
            {flags.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{flags.length}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {result && <span className="text-sm text-gray-600">{result}</span>}
            <button
              onClick={runAnalysis}
              disabled={running}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="trending_up" size="sm" />
              {running ? 'Analysing…' : 'Run Analysis'}
            </button>
          </div>
        </div>
      )}

      {flags.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Icon name="radar" size="lg" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active early warning flags.</p>
          <p className="text-xs mt-1">Run an analysis to detect patterns in student performance data.</p>
        </div>
      ) : (
        <>
          <FlagGroup label="High Severity" groupFlags={high} />
          <FlagGroup label="Medium Severity" groupFlags={medium} />
          <FlagGroup label="Low Severity" groupFlags={low} />
        </>
      )}
    </div>
  )
}
