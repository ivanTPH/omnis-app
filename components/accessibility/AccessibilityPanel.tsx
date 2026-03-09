'use client'

import { useState, useTransition } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { saveAccessibilitySettings } from '@/app/actions/accessibility'
import { ACCESSIBILITY_DEFAULTS, settingsToClasses, type AccessibilitySettings } from '@/lib/accessibility'

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked:  boolean
  onChange: (v: boolean) => void
  id:       string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SettingRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id:          string
  label:       string
  description: string
  checked:     boolean
  onChange:    (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-[13px] font-semibold text-gray-900 cursor-pointer">
          {label}
        </label>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  )
}

// Apply classes to the <html> element immediately for live preview
function applyToHtml(settings: AccessibilitySettings) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  // Remove all accessibility classes first
  el.classList.remove(
    'dyslexia-font', 'high-contrast', 'large-text',
    'reduced-motion', 'line-spacing-wide', 'line-spacing-wider',
  )
  const classes = settingsToClasses(settings)
  if (classes) el.classList.add(...classes.split(' '))
}

export default function AccessibilityPanel({
  initialSettings,
  userId,
  onClose,
}: {
  initialSettings: AccessibilitySettings
  userId:          string
  onClose:         () => void
}) {
  const [settings, setSettings] = useState<AccessibilitySettings>(initialSettings)
  const [pending,  start]       = useTransition()

  function update(patch: Partial<AccessibilitySettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    applyToHtml(next)
    start(async () => {
      await saveAccessibilitySettings(userId, patch)
    })
  }

  function resetAll() {
    setSettings({ ...ACCESSIBILITY_DEFAULTS })
    applyToHtml(ACCESSIBILITY_DEFAULTS)
    start(async () => {
      await saveAccessibilitySettings(userId, { ...ACCESSIBILITY_DEFAULTS })
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="text-[14px] font-bold text-gray-900">Accessibility</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <X size={16} />
        </button>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-auto px-4 py-1">
        <SettingRow
          id="dyslexia-font"
          label="Dyslexia-Friendly Font"
          description="Uses OpenDyslexic with increased letter and word spacing to aid reading."
          checked={settings.dyslexiaFont}
          onChange={v => update({ dyslexiaFont: v })}
        />
        <SettingRow
          id="high-contrast"
          label="High Contrast Mode"
          description="Dark background with bright text for maximum colour contrast."
          checked={settings.highContrast}
          onChange={v => update({ highContrast: v })}
        />
        <SettingRow
          id="large-text"
          label="Larger Text"
          description="Increases base font size by 20% across all pages."
          checked={settings.largeText}
          onChange={v => update({ largeText: v })}
        />
        <SettingRow
          id="reduced-motion"
          label="Reduced Motion"
          description="Disables animations and transitions for those sensitive to movement."
          checked={settings.reducedMotion}
          onChange={v => update({ reducedMotion: v })}
        />

        {/* Line spacing */}
        <div className="py-3">
          <p className="text-[13px] font-semibold text-gray-900 mb-1">Line Spacing</p>
          <p className="text-[11px] text-gray-500 mb-3">Increases the space between lines of text.</p>
          <div className="flex gap-2">
            {(['normal', 'wide', 'wider'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => update({ lineSpacing: opt })}
                className={`flex-1 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                  settings.lineSpacing === opt
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={resetAll}
          disabled={pending}
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RotateCcw size={12} />
          Reset to defaults
        </button>
        {pending && (
          <p className="text-[10px] text-gray-400 mt-1">Saving…</p>
        )}
      </div>
    </div>
  )
}
