'use client'

import { useState, useTransition, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { raiseConcern, getClassStudentsForStrip, suggestLessonAdaptations } from '@/app/actions/send-support'
import { requestLessonSupport } from '@/app/actions/lessons'

// ── Types ─────────────────────────────────────────────────────────────────────

type Student = { id: string; name: string; sendStatus: string }

const CATEGORIES = [
  { value: 'literacy',         label: 'Literacy' },
  { value: 'numeracy',         label: 'Numeracy' },
  { value: 'behaviour',        label: 'Behaviour' },
  { value: 'social_emotional', label: 'Social & Emotional' },
  { value: 'communication',    label: 'Communication' },
  { value: 'sensory',          label: 'Sensory' },
  { value: 'other',            label: 'Other' },
]

// ── Request Support Modal ──────────────────────────────────────────────────────

function RequestSupportModal({
  lessonId, onClose,
}: {
  lessonId: string
  onClose: () => void
}) {
  const [urgency,    setUrgency]    = useState<'low' | 'medium' | 'high'>('medium')
  const [details,    setDetails]    = useState('')
  const [pending,    startTransition] = useTransition()
  const [done,       setDone]       = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await requestLessonSupport(lessonId, urgency, details)
      setDone(true)
      setTimeout(onClose, 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="support_agent" size="md" className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Request In-Lesson Support</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Icon name="close" size="md" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <Icon name="check_circle" size="lg" className="text-green-500 mx-auto mb-3" />
            <p className="font-medium text-gray-900">Support request sent</p>
            <p className="text-sm text-gray-500 mt-1">SENCO and Cover Manager have been notified.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      urgency === u
                        ? u === 'high'    ? 'bg-red-500 text-white border-red-500'
                        : u === 'medium'  ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-blue-500 text-white border-blue-500'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={3}
                placeholder="Describe what support is needed…"
                maxLength={500}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Log Concern Modal ──────────────────────────────────────────────────────────

function LogConcernModal({
  classId, onClose,
}: {
  classId: string
  onClose: () => void
}) {
  const [students,    setStudents]    = useState<Student[]>([])
  const [loading,     setLoading]     = useState(true)
  const [studentId,   setStudentId]   = useState('')
  const [category,    setCategory]    = useState('')
  const [description, setDescription] = useState('')
  const [pending,     startTransition] = useTransition()
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    getClassStudentsForStrip(classId)
      .then(setStudents)
      .finally(() => setLoading(false))
  }, [classId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!studentId) { setError('Please select a student'); return }
    if (!category)  { setError('Please select a category'); return }
    startTransition(async () => {
      try {
        await raiseConcern({ studentId, category, description })
        setDone(true)
        setTimeout(onClose, 1500)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to raise concern')
      }
    })
  }

  const selectedName = students.find(s => s.id === studentId)?.name ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="warning" size="md" className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Log SEND Concern</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Icon name="close" size="md" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <Icon name="check_circle" size="lg" className="text-green-500 mx-auto mb-3" />
            <p className="font-medium text-gray-900">Concern raised</p>
            <p className="text-sm text-gray-500 mt-1">SENCO has been notified about {selectedName}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Icon name="refresh" size="sm" className="animate-spin" />Loading students…
                </div>
              ) : (
                <select
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select student…</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.sendStatus !== 'NONE' ? ` (${s.sendStatus === 'EHCP' ? 'EHCP' : 'SEN Support'})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What did you observe?</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what you observed during this lesson…"
                maxLength={1000}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || loading}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {pending ? 'Raising…' : 'Raise concern'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── K Plans Overlay ────────────────────────────────────────────────────────────

type PreloadedKPlanEntry = {
  id:              string
  name:            string
  sendStatus:      string
  iLearnBestWhen?: string | null
  pleaseHelpMeBy?: string | null
}

function KPlansOverlay({
  classId,
  onClose,
  preloadedStudents,
}: {
  classId: string
  onClose: () => void
  preloadedStudents?: PreloadedKPlanEntry[]
}) {
  const [apiStudents, setApiStudents] = useState<Student[]>([])
  const [loading,     setLoading]     = useState(!preloadedStudents)

  useEffect(() => {
    if (preloadedStudents) return
    getClassStudentsForStrip(classId)
      .then(setApiStudents)
      .finally(() => setLoading(false))
  }, [classId, preloadedStudents])

  const sendStudents: PreloadedKPlanEntry[] = preloadedStudents
    ?? apiStudents.filter(s => s.sendStatus !== 'NONE').map(s => ({ id: s.id, name: s.name, sendStatus: s.sendStatus }))

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-amber-200 rounded-xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Icon name="menu_book" size="sm" className="text-amber-700" />
          <span className="text-sm font-semibold text-amber-800">K Plans — SEND students</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-amber-100">
          <Icon name="close" size="sm" className="text-amber-600" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-gray-400">
          <Icon name="refresh" size="sm" className="animate-spin" />Loading…
        </div>
      ) : sendStudents.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          No SEND students currently in this class.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {sendStudents.map(s => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    s.sendStatus === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {s.sendStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                  </span>
                </div>
                <a
                  href={`/student/${s.id}/send`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800"
                >
                  Full record <Icon name="open_in_new" size="sm" />
                </a>
              </div>
              {(s.iLearnBestWhen || s.pleaseHelpMeBy) ? (
                <div className="bg-emerald-50 rounded-lg px-3 py-2 space-y-1">
                  {s.iLearnBestWhen && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-emerald-700">Learns best: </span>
                      {s.iLearnBestWhen}
                    </p>
                  )}
                  {s.pleaseHelpMeBy && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-emerald-700">Help me by: </span>
                      {s.pleaseHelpMeBy}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">No K Plan content yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InLessonActionStrip({
  lessonId, classId, lessonTitle, preloadedKPlanStudents,
}: {
  lessonId: string
  classId: string
  lessonTitle?: string
  /** Pre-loaded K Plan data from getLessonDetails — avoids extra API call in SEND & Inclusion tab */
  preloadedKPlanStudents?: PreloadedKPlanEntry[]
}) {
  const [supportOpen,  setSupportOpen]  = useState(false)
  const [concernOpen,  setConcernOpen]  = useState(false)
  const [kPlansOpen,   setKPlansOpen]   = useState(false)
  const [suggestions,  setSuggestions]  = useState<string[] | null>(null)
  const [adapting,     startAdaptTransition] = useTransition()

  function handleQuickAdapt() {
    if (suggestions) { setSuggestions(null); return }
    startAdaptTransition(async () => {
      const result = await suggestLessonAdaptations(classId, lessonTitle ?? 'this lesson')
      setSuggestions(result)
    })
  }

  return (
    <>
      {/* ── Amber action strip ── */}
      <div className="relative bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center gap-1 mb-2.5">
          <Icon name="bolt" size="sm" className="text-amber-600 shrink-0" />
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">In-Lesson Actions</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Request support */}
          <button
            onClick={() => setSupportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors shadow-sm"
          >
            <Icon name="support_agent" size="sm" />
            Request support
          </button>

          {/* Log concern */}
          <button
            onClick={() => setConcernOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors shadow-sm"
          >
            <Icon name="warning" size="sm" />
            Log concern
          </button>

          {/* View K Plans */}
          <button
            onClick={() => setKPlansOpen(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm border ${
              kPlansOpen
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Icon name="menu_book" size="sm" />
            View K Plans
          </button>

          {/* Quick adapt */}
          <button
            onClick={handleQuickAdapt}
            disabled={adapting}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm border ${
              suggestions
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100'
            } disabled:opacity-50`}
          >
            <Icon name={adapting ? 'refresh' : 'auto_awesome'} size="sm" className={adapting ? 'animate-spin' : ''} />
            {adapting ? 'Thinking…' : suggestions ? 'Hide suggestions' : 'Quick adapt'}
          </button>
        </div>

        {/* K Plans overlay */}
        {kPlansOpen && (
          <KPlansOverlay
            classId={classId}
            onClose={() => setKPlansOpen(false)}
            preloadedStudents={preloadedKPlanStudents}
          />
        )}

        {/* AI suggestions panel */}
        {suggestions && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Icon name="auto_awesome" size="sm" />Quick adaptations for this class
            </p>
            <ul className="space-y-1.5">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-gray-800">
                  <span className="mt-0.5 w-4 h-4 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Modals */}
      {supportOpen && (
        <RequestSupportModal lessonId={lessonId} onClose={() => setSupportOpen(false)} />
      )}
      {concernOpen && (
        <LogConcernModal classId={classId} onClose={() => setConcernOpen(false)} />
      )}
    </>
  )
}
