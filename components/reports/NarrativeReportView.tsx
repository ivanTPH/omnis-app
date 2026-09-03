'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { gradeLabel } from '@/lib/grading'
import { generateReportNarrativeDraft } from '@/app/actions/reports'
import type { ReportSourceData, ReportNarrativeSections } from '@/app/actions/reports'

type SectionKey = keyof ReportNarrativeSections

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'performance',         label: 'Performance',           hint: 'Overall academic performance this year' },
  { key: 'potential',           label: 'Potential',              hint: 'What this student is capable of' },
  { key: 'areasForImprovement', label: 'Areas for Improvement', hint: 'Specific, actionable next steps' },
]

const EMPTY: ReportNarrativeSections = { performance: '', potential: '', areasForImprovement: '' }

function gapColor(gap: number | null): string {
  if (gap == null) return 'text-gray-400'
  if (gap >= 0) return 'text-green-600'
  if (gap >= -1) return 'text-amber-600'
  return 'text-red-600'
}

export default function NarrativeReportView({ source }: { source: ReportSourceData }) {
  const [narrative, setNarrative]   = useState<ReportNarrativeSections>(EMPTY)
  const [generated, setGenerated]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState<SectionKey | null>(null)
  const [exporting, setExporting]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleGenerateAll() {
    setGenerating(true)
    setError(null)
    try {
      const draft = await generateReportNarrativeDraft(source.studentId)
      if (!draft.performance && !draft.potential && !draft.areasForImprovement) {
        setError('AI draft generation is unavailable right now. You can still write the sections below by hand.')
      }
      setNarrative(draft)
      setGenerated(true)
    } catch {
      setError('AI draft generation failed. You can still write the sections below by hand.')
      setGenerated(true)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate(key: SectionKey) {
    setRegenerating(key)
    setError(null)
    try {
      const draft = await generateReportNarrativeDraft(source.studentId, [key])
      setNarrative(prev => ({ ...prev, [key]: draft[key] || prev[key] }))
    } catch {
      setError(`Couldn't regenerate "${SECTIONS.find(s => s.key === key)?.label}" — try again in a moment.`)
    } finally {
      setRegenerating(null)
    }
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/export/narrative-report/${source.studentId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(narrative),
      })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${source.studentName}-report.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF export failed — please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Structured data — predicted vs actual */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Predicted vs Actual — by Subject</h2>
        {source.subjects.length === 0 ? (
          <p className="text-[12px] text-gray-400">No subject data recorded for this student yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-1.5 font-medium">Subject</th>
                  <th className="py-1.5 font-medium text-center">Predicted</th>
                  <th className="py-1.5 font-medium text-center">Actual</th>
                  <th className="py-1.5 font-medium text-center">Gap</th>
                </tr>
              </thead>
              <tbody>
                {source.subjects.map(s => (
                  <tr key={s.subject} className="border-b border-gray-50">
                    <td className="py-1.5 font-medium text-gray-900">{s.subject}</td>
                    <td className="py-1.5 text-center text-gray-600">{gradeLabel(s.predictedGrade)}</td>
                    <td className="py-1.5 text-center font-semibold text-gray-900">{gradeLabel(s.actualGrade)}</td>
                    <td className={`py-1.5 text-center font-semibold ${gapColor(s.gap)}`}>
                      {s.gap == null ? '—' : s.gap === 0 ? 'On track' : s.gap > 0 ? `+${s.gap}` : s.gap}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Attendance</p>
            <p className="text-[16px] font-bold text-gray-900">{source.attendancePct != null ? `${source.attendancePct.toFixed(1)}%` : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Target grade</p>
            <p className="text-[16px] font-bold text-gray-900">{gradeLabel(source.passport.targetGrade)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Positive points</p>
            <p className="text-[16px] font-bold text-green-600">{source.behaviour.positiveCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Negative points</p>
            <p className="text-[16px] font-bold text-gray-900">{source.behaviour.negativeCount}</p>
          </div>
        </div>

        {source.ilpTargets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Active ILP targets</p>
            <ul className="space-y-1">
              {source.ilpTargets.map((t, i) => (
                <li key={i} className="text-[12px] text-gray-700">
                  {t.target} <span className="text-gray-400">({t.status.replace(/_/g, ' ')})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <Icon name="info" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-800">{error}</p>
        </div>
      )}

      {/* Narrative */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-gray-900">Narrative</h2>
          {!generated && (
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition"
            >
              <Icon name={generating ? 'progress_activity' : 'auto_awesome'} size="sm" className={generating ? 'animate-spin' : ''} />
              {generating ? 'Drafting…' : 'Generate AI draft'}
            </button>
          )}
        </div>

        {!generated ? (
          <p className="text-[12px] text-gray-400">
            Generate a first draft grounded only in the data above — grades, attendance, ILP targets, and
            behaviour points. Nothing else is used. You&apos;ll review and edit every word before export.
          </p>
        ) : (
          <div className="space-y-5">
            {SECTIONS.map(({ key, label, hint }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[12px] font-semibold text-gray-700">{label}</label>
                  <button
                    type="button"
                    onClick={() => handleRegenerate(key)}
                    disabled={regenerating === key}
                    className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    <Icon name={regenerating === key ? 'progress_activity' : 'refresh'} size="sm" className={regenerating === key ? 'animate-spin' : ''} />
                    Regenerate
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>
                <textarea
                  value={narrative[key]}
                  onChange={e => setNarrative(prev => ({ ...prev, [key]: e.target.value }))}
                  rows={4}
                  className="w-full text-[13px] text-gray-900 border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  placeholder={`Write ${label.toLowerCase()} here…`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-[12px] text-gray-500">
          Exports exactly the text above, captioned as prepared by you — nothing is sent to a parent automatically.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition shrink-0"
        >
          <Icon name={exporting ? 'progress_activity' : 'picture_as_pdf'} size="sm" className={exporting ? 'animate-spin' : ''} />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
    </div>
  )
}
