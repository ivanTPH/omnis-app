'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { generateRevisionPlan, saveRevisionPlan } from '@/app/actions/revision'

type Exam = {
  id:      string
  subject: string
  examDate: Date
  paperName: string | null
}

type GeneratedSession = {
  subject:     string
  topic:       string
  scheduledAt: string
  durationMins: number
  examId:      string | null
}

const PREFERRED_SLOTS = ['morning', 'afternoon', 'evening']

export default function PlanGeneratorModal({
  exams,
  studentId,
  onClose,
  onRefresh,
}: {
  exams:     Exam[]
  studentId: string
  onClose:   () => void
  onRefresh: () => void
}) {
  const [step,       setStep]       = useState<1 | 2 | 3 | 'preview'>(1)
  const [pending,    start]         = useTransition()

  // Step 1 — exam selection
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set(exams.map(e => e.id)))

  // Step 2 — availability
  const [hoursPerDay,     setHoursPerDay]     = useState(2)
  const [preferredSlots,  setPreferredSlots]  = useState<Set<string>>(new Set(['evening']))

  // Step 3 — confidence
  const subjects = [...new Set(exams.map(e => e.subject))]
  const [confidence, setConfidence] = useState<Record<string, number>>(
    Object.fromEntries(subjects.map(s => [s, 3]))
  )

  // Preview
  const [sessions, setSessions] = useState<GeneratedSession[]>([])
  const [aiError,  setAiError]  = useState<string | null>(null)

  function toggleExam(id: string) {
    setSelectedExams(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSlot(slot: string) {
    setPreferredSlots(prev => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot); else next.add(slot)
      return next
    })
  }

  function handleGenerate() {
    setAiError(null)
    start(async () => {
      const result = await generateRevisionPlan(studentId, {
        examIds:           [...selectedExams],
        weeksUntilExams:   4,
        hoursPerDay,
        preferredSlots:    [...preferredSlots],
        confidenceRatings: confidence,
      })
      setSessions(result.sessions)
      if (result.error) setAiError(result.error)
      setStep('preview')
    })
  }

  function handleAccept() {
    start(async () => {
      await saveRevisionPlan(studentId, sessions)
      onRefresh()
      onClose()
    })
  }

  const weeksUntilLabel = (date: Date) => {
    const days = Math.round((new Date(date).getTime() - Date.now()) / 86400000)
    return days < 0 ? 'Past' : `${Math.ceil(days / 7)}w away`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="auto_fix_high" size="sm" className="text-blue-600" />
            <h2 className="text-[15px] font-bold text-gray-900">Generate Revision Plan</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="close" size="md" /></button>
        </div>

        {/* Step indicator */}
        {step !== 'preview' && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 shrink-0">
            {([1,2,3] as const).map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === n ? 'bg-blue-600 text-white' : step > n ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > n ? <Icon name="check" size="sm" /> : n}
                </div>
                <span className={`text-[11px] ${step === n ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {n === 1 ? 'Select Exams' : n === 2 ? 'Availability' : 'Confidence'}
                </span>
                {n < 3 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">

          {/* Step 1 — Exams */}
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-[12px] text-gray-500 mb-3">Select the exams you want to plan for:</p>
              {exams.length === 0 && (
                <p className="text-[12px] text-gray-400 text-center py-4">
                  No exams added yet. Close this and add exams first.
                </p>
              )}
              {exams.map(exam => (
                <label key={exam.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedExams.has(exam.id)}
                    onChange={() => toggleExam(exam.id)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-gray-900">{exam.subject}</span>
                    {exam.paperName && <span className="text-[11px] text-gray-500 ml-2">{exam.paperName}</span>}
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{weeksUntilLabel(exam.examDate)}</span>
                </label>
              ))}
            </div>
          )}

          {/* Step 2 — Availability */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-2">
                  Hours available per day
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0.5} max={6} step={0.5}
                    value={hoursPerDay}
                    onChange={e => setHoursPerDay(Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-[14px] font-bold text-blue-600 w-10 text-right">
                    {hoursPerDay}h
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-2">
                  Preferred revision times
                </label>
                <div className="flex gap-2">
                  {PREFERRED_SLOTS.map(slot => (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(slot)}
                      className={`flex-1 py-2 text-[12px] font-semibold rounded-xl border transition-colors ${
                        preferredSlots.has(slot)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {slot.charAt(0).toUpperCase() + slot.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Confidence */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[12px] text-gray-500">
                Rate your current confidence in each subject (1 = not confident, 5 = very confident):
              </p>
              {subjects.map(subj => (
                <div key={subj}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-gray-800">{subj}</span>
                    <span className="text-[12px] text-blue-600 font-bold">{confidence[subj]}/5</span>
                  </div>
                  <input
                    type="range" min={1} max={5} step={1}
                    value={confidence[subj]}
                    onChange={e => setConfidence(prev => ({ ...prev, [subj]: Number(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                    <span>Not confident</span>
                    <span>Very confident</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div>
              {aiError && (
                <div className="mb-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {aiError}
                </div>
              )}
              <p className="text-[12px] text-gray-500 mb-3">
                {sessions.length} sessions generated. Review and accept to add them to your planner.
              </p>
              <div className="space-y-1.5">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-gray-900">{s.subject} — {s.topic}</div>
                      <div className="text-[11px] text-gray-500">
                        {new Date(s.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}{new Date(s.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{s.durationMins}min
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          {step === 1 && (
            <>
              <button onClick={onClose} className="px-4 py-2.5 text-[13px] text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                onClick={() => setStep(2)}
                disabled={selectedExams.size === 0}
                className="flex-1 py-2.5 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                Next →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="px-4 py-2.5 text-[13px] text-gray-500 hover:text-gray-700">← Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={preferredSlots.size === 0}
                className="flex-1 py-2.5 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                Next →
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} className="px-4 py-2.5 text-[13px] text-gray-500 hover:text-gray-700">← Back</button>
              <button
                onClick={handleGenerate}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? <><Icon name="refresh" size="sm" className="animate-spin" />Generating…</> : <><Icon name="auto_fix_high" size="sm" />Generate Plan</>}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button
                onClick={handleGenerate}
                disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                <Icon name="refresh" size="sm" className={pending ? 'animate-spin' : ''} />
                Regenerate
              </button>
              <button
                onClick={handleAccept}
                disabled={pending || sessions.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? <><Icon name="refresh" size="sm" className="animate-spin" />Saving…</> : <><Icon name="check" size="sm" />Accept Plan</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
