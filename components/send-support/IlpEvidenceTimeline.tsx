'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { updateIlpEvidence } from '@/app/actions/homework'
import { formatRawScore } from '@/lib/gradeUtils'

type EvidenceEntry = {
  id:           string
  evidenceType: string
  homeworkTitle: string
  aiSummary:    string | null
  teacherNote:  string | null
  subject:      string | null
  score:        number | null
  createdAt:    string | Date
}

const TYPE_OPTS: { value: 'PROGRESS' | 'CONCERN' | 'NEUTRAL'; label: string; cls: string }[] = [
  { value: 'PROGRESS', label: 'Progress',  cls: 'bg-green-100 text-green-700' },
  { value: 'CONCERN',  label: 'Concern',   cls: 'bg-rose-100 text-rose-700'   },
  { value: 'NEUTRAL',  label: 'Neutral',   cls: 'bg-gray-100 text-gray-500'   },
]

const DOT_CLS: Record<string, string> = {
  PROGRESS: 'bg-green-400',
  CONCERN:  'bg-rose-400',
  NEUTRAL:  'bg-gray-300',
}

export default function IlpEvidenceTimeline({
  entries,
}: {
  entries: EvidenceEntry[]
}) {
  const router = useRouter()
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editType,     setEditType]     = useState<'PROGRESS' | 'CONCERN' | 'NEUTRAL'>('NEUTRAL')
  const [editNote,     setEditNote]     = useState('')
  const [saving,       startSaving]     = useTransition()
  const [saveErr,      setSaveErr]      = useState<string | null>(null)

  function openEdit(entry: EvidenceEntry) {
    setEditingId(entry.id)
    setEditType(entry.evidenceType as 'PROGRESS' | 'CONCERN' | 'NEUTRAL')
    setEditNote(entry.teacherNote ?? '')
    setSaveErr(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setSaveErr(null)
  }

  function handleSave(entry: EvidenceEntry) {
    setSaveErr(null)
    startSaving(async () => {
      try {
        await updateIlpEvidence(entry.id, { evidenceType: editType, teacherNote: editNote })
        setEditingId(null)
        router.refresh()
      } catch {
        setSaveErr('Failed to save — please try again.')
      }
    })
  }

  if (entries.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Icon name="task_alt" size="sm" className="text-blue-500" />
        <h2 className="text-[14px] font-semibold text-gray-900">ILP Evidence Timeline</h2>
        <span className="ml-auto text-[11px] text-gray-400">
          {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {entries.slice(0, 10).map(entry => {
          const isEditing = editingId === entry.id
          const typeMeta  = TYPE_OPTS.find(o => o.value === entry.evidenceType)
          return (
            <div key={entry.id} className="px-5 py-3">
              {isEditing ? (
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-gray-800">{entry.homeworkTitle}</p>

                  {/* Classification select */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-24 shrink-0">Classification</label>
                    <select
                      value={editType}
                      onChange={e => setEditType(e.target.value as any)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {TYPE_OPTS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Teacher note */}
                  <div className="flex items-start gap-2">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-24 shrink-0 pt-1.5">Note</label>
                    <textarea
                      rows={2}
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="Add or update teacher note…"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    />
                  </div>

                  {saveErr && (
                    <p className="text-[11px] text-rose-600">{saveErr}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(entry)}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="save" size="sm" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLS[entry.evidenceType] ?? 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12px] font-medium text-gray-800 truncate">{entry.homeworkTitle}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeMeta?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                        {typeMeta?.label ?? entry.evidenceType}
                      </span>
                    </div>
                    {entry.aiSummary && (
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{entry.aiSummary}</p>
                    )}
                    {entry.teacherNote && (
                      <p className="text-[11px] text-blue-600 italic mt-0.5">{entry.teacherNote}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {entry.subject && ` · ${entry.subject}`}
                      {entry.score != null && ` · ${formatRawScore(entry.score)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => openEdit(entry)}
                    title="Edit classification"
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 hover:text-blue-500 transition-colors"
                  >
                    <Icon name="edit" size="sm" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
