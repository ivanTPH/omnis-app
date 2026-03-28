'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { createIlp } from '@/app/actions/send-support'

const SEND_CATEGORIES = [
  'Cognition and Learning', 'Communication and Interaction',
  'Social, Emotional and Mental Health', 'Sensory and/or Physical',
  'SpLD (Dyslexia/Dyspraxia)', 'ASD', 'ADHD', 'Other',
]

const STRATEGY_OPTIONS = [
  'Seat near the front of the class',
  'Provide written instructions alongside verbal',
  'Allow extra time for tasks',
  'Use visual aids and diagrams',
  'Break tasks into smaller steps',
  'Provide sentence starters and writing frames',
  'Use larger font and cream-coloured paper',
  'Check for understanding frequently',
  'Allow use of word processor / keyboard',
  'Reduce unnecessary copying',
  'Give advance notice of any changes to routine',
  'Use positive behaviour reinforcement',
  'Provide a quiet, distraction-free space when needed',
]

type TargetInput = { target: string; strategy: string; successMeasure: string; targetDate: string }

type Props = { studentId: string; studentName: string; onClose: () => void }

export default function IlpForm({ studentId, studentName, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [sendCategory,     setSendCategory]     = useState('')
  const [currentStrengths, setCurrentStrengths] = useState('')
  const [areasOfNeed,      setAreasOfNeed]      = useState('')

  // Step 2
  const [targets, setTargets] = useState<TargetInput[]>([
    { target: '', strategy: '', successMeasure: '', targetDate: '' },
  ])

  // Step 3
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([])
  const [extraStrategy,      setExtraStrategy]      = useState('')
  const [successCriteria,    setSuccessCriteria]    = useState('')
  const [reviewDate,         setReviewDate]         = useState('')

  function toggleStrategy(s: string) {
    setSelectedStrategies(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  function addTarget() {
    if (targets.length < 5) {
      setTargets(prev => [...prev, { target: '', strategy: '', successMeasure: '', targetDate: '' }])
    }
  }

  function removeTarget(i: number) {
    setTargets(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateTarget(i: number, field: keyof TargetInput, value: string) {
    setTargets(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  async function handleSubmit() {
    setError(null)
    const allStrategies = [
      ...selectedStrategies,
      ...(extraStrategy.trim() ? [extraStrategy.trim()] : []),
    ]
    const parsedTargets = targets.map(t => ({
      target: t.target,
      strategy: t.strategy,
      successMeasure: t.successMeasure,
      targetDate: new Date(t.targetDate),
    }))

    setSaving(true)
    try {
      await createIlp({
        studentId,
        sendCategory,
        currentStrengths,
        areasOfNeed,
        targets: parsedTargets,
        strategies: allStrategies,
        successCriteria,
        reviewDate: new Date(reviewDate),
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ILP')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="p-8 text-center">
        <Icon name="check_circle" size="lg" className="text-green-500 mx-auto mb-3" />
        <p className="font-medium text-gray-900">ILP created</p>
        <p className="text-sm text-gray-500 mt-1">The ILP for {studentName} has been saved. Teachers have been notified.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Close</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-blue-600' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400">Step {step} of 3 — Creating ILP for {studentName}</p>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary SEND Category *</label>
            <select value={sendCategory} onChange={e => setSendCategory(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select category…</option>
              {SEND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Strengths *</label>
            <textarea value={currentStrengths} onChange={e => setCurrentStrengths(e.target.value)} rows={3}
              placeholder="What the student does well…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Areas of Need *</label>
            <textarea value={areasOfNeed} onChange={e => setAreasOfNeed(e.target.value)} rows={3}
              placeholder="Specific areas requiring support…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <button
            onClick={() => { if (sendCategory && currentStrengths && areasOfNeed) setStep(2); else setError('Please complete all fields') }}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
          >Next: Add Targets</button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          {targets.map((t, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Target {i + 1}</p>
                {targets.length > 1 && (
                  <button onClick={() => removeTarget(i)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                    <Icon name="delete" size="sm" />
                  </button>
                )}
              </div>
              <input value={t.target} onChange={e => updateTarget(i, 'target', e.target.value)}
                placeholder="Specific measurable target…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={t.strategy} onChange={e => updateTarget(i, 'strategy', e.target.value)}
                placeholder="How it will be achieved…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={t.successMeasure} onChange={e => updateTarget(i, 'successMeasure', e.target.value)}
                placeholder="How success will be measured…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div>
                <label className="text-xs text-gray-500">Target date</label>
                <input type="date" value={t.targetDate} onChange={e => updateTarget(i, 'targetDate', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
          ))}
          {targets.length < 5 && (
            <button onClick={addTarget} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
              <Icon name="add" size="sm" /> Add another target
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Back</button>
            <button onClick={() => {
              const valid = targets.every(t => t.target && t.strategy && t.successMeasure && t.targetDate)
              if (valid) setStep(3); else setError('Please complete all target fields')
            }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Next: Strategies</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Teaching strategies</p>
            <div className="grid grid-cols-1 gap-1.5">
              {STRATEGY_OPTIONS.map(s => (
                <label key={s} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedStrategies.includes(s)} onChange={() => toggleStrategy(s)}
                    className="mt-0.5 rounded" />
                  <span className="text-sm text-gray-700">{s}</span>
                </label>
              ))}
            </div>
            <input value={extraStrategy} onChange={e => setExtraStrategy(e.target.value)}
              placeholder="Additional strategy (optional)…" className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Success Criteria *</label>
            <textarea value={successCriteria} onChange={e => setSuccessCriteria(e.target.value)} rows={2}
              placeholder="What success looks like overall…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Date *</label>
            <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Back</button>
            <button
              onClick={handleSubmit}
              disabled={saving || !successCriteria || !reviewDate}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >{saving ? 'Creating…' : 'Create ILP'}</button>
          </div>
        </div>
      )}

      {error && step !== 3 && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
