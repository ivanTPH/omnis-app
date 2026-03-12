'use client'

import { useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { generateIlpProgressReport, generateEhcpAnnualReview } from '@/app/actions/ehcp'

type ReportType = 'ilp' | 'ehcp'

type Props = {
  studentId: string
  studentName: string
  type: ReportType
}

export default function IlpProgressReportViewer({ studentId, studentName, type }: Props) {
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError('')
    try {
      const text = type === 'ilp'
        ? await generateIlpProgressReport(studentId)
        : await generateEhcpAnnualReview(studentId)
      setReport(text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const label = type === 'ilp' ? 'ILP Progress Report' : 'EHCP Annual Review'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">{label}</h3>
          <p className="text-sm text-gray-500">{studentName}</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Generating…' : report ? 'Regenerate' : 'Generate Report'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!report && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
          Click &apos;Generate Report&apos; to create an AI-assisted {label.toLowerCase()} for {studentName}.
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              This is an AI-assisted draft. It must be reviewed, edited, and approved by a qualified professional before use.
              {type === 'ehcp' && ' EHCP annual reviews also require Local Authority sign-off.'}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
            {report.replace(/^⚠️.*?\n\n/, '')}
          </div>
        </div>
      )}
    </div>
  )
}
