'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { upsertKPlan, generateKPlanDraft, type KPlanData } from '@/app/actions/kplan'

type Props = {
  kplan:       KPlanData | null
  studentId:   string
  studentName: string
  isSenco:     boolean
}

export default function KPlanStudentVoiceSection({ kplan: initial, studentId, studentName, isSenco }: Props) {
  const [kplan,      setKplan]      = useState<KPlanData | null>(initial)
  const [expanded,   setExpanded]   = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving,     startSave]     = useTransition()
  const [error,      setError]      = useState<string | null>(null)

  // Draft edit state
  const [iLearnBestWhen,         setILearnBestWhen]         = useState(initial?.iLearnBestWhen ?? '')
  const [pleaseHelpMeBy,         setPleaseHelpMeBy]         = useState(initial?.pleaseHelpMeBy ?? '')
  const [dontDoThis,             setDontDoThis]             = useState(initial?.dontDoThis ?? '')
  const [myStrengths,            setMyStrengths]            = useState((initial?.myStrengths ?? []).join('\n'))
  const [communicationStyle,     setCommunicationStyle]     = useState(initial?.communicationStyle ?? '')
  const [examAccessArrangements, setExamAccessArrangements] = useState((initial?.examAccessArrangements ?? []).join('\n'))

  const firstName = studentName.split(' ')[0]

  function syncEditorFromKplan(k: KPlanData) {
    setILearnBestWhen(k.iLearnBestWhen ?? '')
    setPleaseHelpMeBy(k.pleaseHelpMeBy ?? '')
    setDontDoThis(k.dontDoThis ?? '')
    setMyStrengths((k.myStrengths ?? []).join('\n'))
    setCommunicationStyle(k.communicationStyle ?? '')
    setExamAccessArrangements((k.examAccessArrangements ?? []).join('\n'))
  }

  async function handleConsentToggle() {
    if (!isSenco) return
    const newConsent = !(kplan?.gdprConsented ?? false)
    startSave(async () => {
      try {
        const updated = await upsertKPlan(studentId, { gdprConsented: newConsent })
        setKplan(updated)
      } catch {
        setError('Failed to update consent.')
      }
    })
  }

  async function handleGenerate() {
    if (!kplan?.gdprConsented) {
      setError('Enable GDPR consent before generating.')
      return
    }
    setError(null)
    setGenerating(true)
    try {
      const res = await generateKPlanDraft(studentId)
      if (res.success && res.kplan) {
        setKplan(res.kplan)
        syncEditorFromKplan(res.kplan)
        setEditing(false)
        setExpanded(true)
      } else {
        setError(res.error ?? 'Generation failed.')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setError(null)
    startSave(async () => {
      try {
        const updated = await upsertKPlan(studentId, {
          iLearnBestWhen:         iLearnBestWhen   || undefined,
          pleaseHelpMeBy:         pleaseHelpMeBy   || undefined,
          dontDoThis:             dontDoThis       || undefined,
          myStrengths:            myStrengths.split('\n').map(s => s.trim()).filter(Boolean),
          communicationStyle:     communicationStyle || undefined,
          examAccessArrangements: examAccessArrangements.split('\n').map(s => s.trim()).filter(Boolean),
        })
        setKplan(updated)
        syncEditorFromKplan(updated)
        setEditing(false)
        setExpanded(true)
      } catch {
        setError('Failed to save K Plan.')
      }
    })
  }

  const hasContent = kplan && (
    kplan.iLearnBestWhen || kplan.pleaseHelpMeBy || kplan.dontDoThis ||
    kplan.myStrengths.length > 0 || kplan.communicationStyle
  )

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-700 text-white">
        <div className="flex items-center gap-2">
          <Icon name="menu_book" size="sm" className="text-emerald-200 shrink-0" />
          <span className="text-[12px] font-semibold">K Plan — Learning Passport</span>
          <span className="text-[10px] text-emerald-300 ml-1">({firstName}&apos;s voice)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* GDPR consent toggle — SENCO only */}
          {isSenco && (
            <button
              type="button"
              onClick={handleConsentToggle}
              disabled={saving}
              title={kplan?.gdprConsented ? 'GDPR consent on — click to revoke' : 'Enable GDPR consent to allow AI generation'}
              className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full transition-colors ${
                kplan?.gdprConsented
                  ? 'bg-green-500 text-white'
                  : 'bg-emerald-600 text-emerald-200 hover:bg-emerald-500'
              }`}
            >
              <Icon name={kplan?.gdprConsented ? 'check_circle' : 'radio_button_unchecked'} size="sm" />
              GDPR{kplan?.gdprConsented ? ' ✓' : '?'}
            </button>
          )}
          {isSenco && (
            <>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !kplan?.gdprConsented}
                title={kplan?.gdprConsented ? 'AI-generate draft from ILP data' : 'Enable GDPR consent first'}
                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                {generating
                  ? <><Icon name="refresh" size="sm" className="animate-spin" />Generating…</>
                  : <><Icon name="auto_fix_high" size="sm" />Generate draft</>
                }
              </button>
              <button
                type="button"
                onClick={() => { setEditing(e => !e); setExpanded(true) }}
                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              >
                <Icon name={editing ? 'close' : 'edit'} size="sm" />
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </>
          )}
          {hasContent && !editing && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="p-1 text-emerald-200 hover:text-white transition-colors"
            >
              <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" />
            </button>
          )}
        </div>
      </div>

      {/* No K Plan yet */}
      {!kplan && (
        <div className="px-4 py-4">
          <p className="text-[12px] text-emerald-700 italic">
            No K Plan yet.{isSenco ? ' Enable GDPR consent above, then click "Generate draft" to create one from ILP data.' : ''}
          </p>
        </div>
      )}

      {/* GDPR not consented warning */}
      {kplan && !kplan.gdprConsented && !hasContent && isSenco && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-t border-amber-200">
          <Icon name="lock" size="sm" className="text-amber-500 shrink-0" />
          <p className="text-[12px] text-amber-800">Enable GDPR consent above to generate or edit this K Plan.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-t border-red-200">
          <Icon name="error" size="sm" className="text-red-500 shrink-0" />
          <p className="text-[12px] text-red-700">{error}</p>
        </div>
      )}

      {/* Edit form */}
      {editing && isSenco && (
        <div className="px-4 py-4 space-y-4 border-t border-emerald-200">
          <p className="text-[11px] text-emerald-700 italic">
            Write in {firstName}&apos;s first-person voice. No clinical labels or diagnosis terms.
          </p>

          {[
            { label: `I learn best when…`, value: iLearnBestWhen, set: setILearnBestWhen, placeholder: `I learn best when instructions are broken into steps…` },
            { label: `Please help me by…`, value: pleaseHelpMeBy, set: setPleaseHelpMeBy, placeholder: `Please help me by giving me a moment to think before answering…` },
            { label: `It doesn't help me when…`, value: dontDoThis, set: setDontDoThis, placeholder: `It doesn't help me when I'm put on the spot without warning…` },
            { label: `Communication style`, value: communicationStyle, set: setCommunicationStyle, placeholder: `I find it easier when feedback is written as well as spoken…` },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide block mb-1">{label}</label>
              <textarea
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="w-full text-[12px] text-gray-900 bg-white border border-emerald-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
            </div>
          ))}

          <div>
            <label className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide block mb-1">My strengths (one per line)</label>
            <textarea
              value={myStrengths}
              onChange={e => setMyStrengths(e.target.value)}
              placeholder="Creative thinking&#10;Good listener&#10;Strong visual memory"
              rows={3}
              className="w-full text-[12px] text-gray-900 bg-white border border-emerald-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide block mb-1">Exam access arrangements (one per line)</label>
            <textarea
              value={examAccessArrangements}
              onChange={e => setExamAccessArrangements(e.target.value)}
              placeholder="25% extra time&#10;Reader"
              rows={2}
              className="w-full text-[12px] text-gray-900 bg-white border border-emerald-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="save" size="sm" />}
              Save K Plan
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[12px] text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Read-only view */}
      {!editing && hasContent && expanded && (
        <div className="px-4 py-4 border-t border-emerald-200 space-y-4">
          {kplan!.iLearnBestWhen && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">I learn best when…</p>
              <p className="text-[13px] text-gray-800 leading-relaxed">{kplan!.iLearnBestWhen}</p>
            </div>
          )}
          {kplan!.pleaseHelpMeBy && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Please help me by…</p>
              <p className="text-[13px] text-gray-800 leading-relaxed">{kplan!.pleaseHelpMeBy}</p>
            </div>
          )}
          {kplan!.dontDoThis && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">It doesn&apos;t help me when…</p>
              <p className="text-[13px] text-gray-800 leading-relaxed">{kplan!.dontDoThis}</p>
            </div>
          )}
          {kplan!.myStrengths.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">My strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {kplan!.myStrengths.map((s, i) => (
                  <span key={i} className="text-[11px] font-medium px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {kplan!.communicationStyle && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Communication style</p>
              <p className="text-[13px] text-gray-800 leading-relaxed">{kplan!.communicationStyle}</p>
            </div>
          )}
          {kplan!.examAccessArrangements.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Exam access arrangements</p>
              <div className="flex flex-wrap gap-1.5">
                {kplan!.examAccessArrangements.map((a, i) => (
                  <span key={i} className="text-[11px] font-medium px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}
          {kplan!.updatedAt && (
            <p className="text-[10px] text-emerald-500 pt-1">
              Last updated {new Date(kplan!.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}

      {/* Preview line when collapsed */}
      {!editing && hasContent && !expanded && (
        <div className="px-4 py-3 border-t border-emerald-200">
          <p className="text-[12px] text-emerald-800 line-clamp-1 italic">
            {kplan!.iLearnBestWhen ?? kplan!.pleaseHelpMeBy ?? '…'}
          </p>
        </div>
      )}
    </div>
  )
}
