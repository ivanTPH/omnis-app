'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { SencoRow } from '@/components/ui/SencoRow'
import type { EarlyWarningFlagRow } from '@/app/actions/send-support'
import { resolveEarlyWarningFlag, triggerEarlyWarningAnalysis } from '@/app/actions/send-support'
import EarlyWarningActionSlideOver from './EarlyWarningActionSlideOver'

export const FLAG_TYPE_LABELS: Record<string, string> = {
  completion_drop:   'Completion Drop',
  score_decline:     'Score Decline',
  multiple_concerns: 'Multiple Concerns',
  pattern_absence:   'Missed Homeworks',
  homework_decline:  'Homework Decline',
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  notify_teachers:  'Notified teachers',
  schedule_meeting: 'SENCO meeting scheduled',
  refer_external:   'Referred for external support',
  monitor:          'Monitoring — no action needed',
  other:            'Other action taken',
}

const SEVERITY_AVATAR: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-blue-400',
}

export function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === 'high'   ? 'badge-high'   :
    severity === 'medium' ? 'badge-medium' :
    severity === 'low'    ? 'badge-low'    :
    'badge-open'
  return <span className={`inline-flex items-center whitespace-nowrap ${cls}`}>{severity}</span>
}

type ActionedFlag = EarlyWarningFlagRow & {
  resolvedActionType: string
  resolvedNotes: string
  resolvedByName: string
  resolvedAt: Date
}

type Props = { flags: EarlyWarningFlagRow[]; compact?: boolean }

export default function EarlyWarningPanel({ flags: initialFlags, compact }: Props) {
  const [flags,         setFlags]         = useState(initialFlags)
  const [actionedFlags, setActionedFlags] = useState<ActionedFlag[]>([])
  const [actioningFlag, setActioningFlag] = useState<EarlyWarningFlagRow | null>(null)
  const [showActioned,  setShowActioned]  = useState(false)
  const [running,       setRunning]       = useState(false)
  const [result,        setResult]        = useState<string | null>(null)
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set())

  const high   = flags.filter(f => f.severity === 'high')
  const medium = flags.filter(f => f.severity === 'medium')
  const low    = flags.filter(f => f.severity === 'low')

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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

  function handleResolved(flag: EarlyWarningFlagRow, result: { actionType: string; notes: string; actionedByName: string }) {
    setFlags(prev => prev.filter(f => f.id !== flag.id))
    setActionedFlags(prev => [...prev, {
      ...flag,
      resolvedActionType: result.actionType,
      resolvedNotes:      result.notes,
      resolvedByName:     result.actionedByName,
      resolvedAt:         new Date(),
    }])
    setActioningFlag(null)
  }

  function FlagGroup({ label, groupFlags }: { label: string; groupFlags: EarlyWarningFlagRow[] }) {
    if (groupFlags.length === 0) return null
    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h3>
        {groupFlags.map(f => {
          const initials = f.studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          return (
            <SencoRow
              key={f.id}
              studentName={f.studentName}
              studentInitials={initials}
              avatarColour={SEVERITY_AVATAR[f.severity] ?? 'bg-gray-400'}
              studentHref={`/student/${f.studentId}/send`}
              badges={[
                { label: f.severity, variant: f.severity as 'high' | 'medium' | 'low' },
                { label: FLAG_TYPE_LABELS[f.flagType] ?? f.flagType.replace(/_/g, ' '), variant: 'open' },
              ]}
              meta={[
                { label: 'SEVERITY', value: f.severity },
                { label: 'TYPE',     value: FLAG_TYPE_LABELS[f.flagType] ?? f.flagType.replace(/_/g, ' ') },
                { label: 'DETECTED', value: new Date(f.createdAt).toLocaleDateString('en-GB') },
                { label: 'EXPIRES',  value: new Date(f.expiresAt).toLocaleDateString('en-GB') },
              ]}
              rightContent={
                <button
                  onClick={() => setActioningFlag(f)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
                >
                  <Icon name="check_circle" size="sm" />
                  Action
                </button>
              }
              isExpanded={expanded.has(f.id)}
              onToggle={() => toggle(f.id)}
            >
              <div className="space-y-3">
                <p className="text-sm text-gray-700">{f.description}</p>
              </div>
            </SencoRow>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header — hidden in compact mode */}
        {!compact && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="radar" size="md" className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">Early Warning Flags</h2>
              {flags.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {flags.length}
                </span>
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

        {flags.length === 0 && actionedFlags.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon name="radar" size="lg" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No active early warning flags.</p>
            <p className="text-xs mt-1">Run an analysis to detect patterns in student performance data.</p>
          </div>
        ) : (
          <>
            <FlagGroup label="High Severity"   groupFlags={high}   />
            <FlagGroup label="Medium Severity" groupFlags={medium} />
            <FlagGroup label="Low Severity"    groupFlags={low}    />

            {/* Actioned section */}
            {actionedFlags.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowActioned(v => !v)}
                  className="text-sm text-gray-500 flex items-center gap-1 hover:text-gray-700"
                >
                  <Icon name={showActioned ? 'expand_less' : 'expand_more'} size="sm" />
                  {showActioned ? 'Hide' : 'Show'} actioned flags ({actionedFlags.length})
                </button>

                {showActioned && (
                  <div className="mt-3">
                    {actionedFlags.map(f => {
                      const initials = f.studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <SencoRow
                          key={f.id}
                          studentName={f.studentName}
                          studentInitials={initials}
                          avatarColour="bg-gray-300"
                          studentHref={`/student/${f.studentId}/send`}
                          badges={[
                            { label: f.severity, variant: f.severity as 'high' | 'medium' | 'low' },
                            { label: FLAG_TYPE_LABELS[f.flagType] ?? f.flagType.replace(/_/g, ' '), variant: 'open' },
                          ]}
                          meta={[
                            { label: 'SEVERITY',    value: f.severity },
                            { label: 'TYPE',        value: FLAG_TYPE_LABELS[f.flagType] ?? f.flagType.replace(/_/g, ' ') },
                            { label: 'DETECTED',    value: new Date(f.createdAt).toLocaleDateString('en-GB') },
                            { label: 'ACTIONED BY', value: f.resolvedByName },
                          ]}
                          rightContent={
                            <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                              <Icon name="check_circle" size="sm" />
                              Actioned
                            </span>
                          }
                          isExpanded={expanded.has(f.id)}
                          onToggle={() => toggle(f.id)}
                        >
                          <div className="space-y-2">
                            <p className="text-sm text-gray-700">{f.description}</p>
                            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 space-y-0.5">
                              <p className="text-xs font-medium text-green-800">
                                {ACTION_TYPE_LABELS[f.resolvedActionType] ?? f.resolvedActionType}
                              </p>
                              {f.resolvedNotes && (
                                <p className="text-xs text-green-700">{f.resolvedNotes}</p>
                              )}
                              <p className="text-xs text-green-600">
                                Actioned by {f.resolvedByName} · {f.resolvedAt.toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                        </SencoRow>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action slide-over */}
      {actioningFlag && (
        <EarlyWarningActionSlideOver
          flag={actioningFlag}
          onClose={() => setActioningFlag(null)}
          onResolve={resolveEarlyWarningFlag}
          onResolved={result => handleResolved(actioningFlag, result)}
        />
      )}
    </>
  )
}
