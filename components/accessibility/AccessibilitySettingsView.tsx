'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { saveAccessibilitySettings } from '@/app/actions/accessibility'
import { ACCESSIBILITY_DEFAULTS, hasActiveSettings, settingsToClasses, type AccessibilitySettings } from '@/lib/accessibility'

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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

function applyToHtml(settings: AccessibilitySettings) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.classList.remove(
    'dyslexia-font', 'high-contrast', 'large-text',
    'reduced-motion', 'line-spacing-wide', 'line-spacing-wider',
  )
  const classes = settingsToClasses(settings)
  if (classes) el.classList.add(...classes.split(' '))
}

type Setting = {
  key:         keyof Omit<AccessibilitySettings, 'lineSpacing'>
  iconName:    string
  label:       string
  description: string
  whoHelps:    string
}

const SETTINGS: Setting[] = [
  {
    key:         'dyslexiaFont',
    iconName:    'menu_book',
    label:       'Dyslexia-Friendly Font',
    description: 'Switches to OpenDyslexic with increased letter and word spacing.',
    whoHelps:    'Helps users with dyslexia, visual stress, or reading difficulties.',
  },
  {
    key:         'highContrast',
    iconName:    'visibility',
    label:       'High Contrast Mode',
    description: 'Dark background with bright, high-contrast text and borders.',
    whoHelps:    'Helps users with low vision, colour blindness, or light sensitivity.',
  },
  {
    key:         'largeText',
    iconName:    'text_fields',
    label:       'Larger Text',
    description: 'Increases the base font size by 20% across all pages.',
    whoHelps:    'Helps users with visual impairments or those who prefer larger text.',
  },
  {
    key:         'reducedMotion',
    iconName:    'bolt',
    label:       'Reduced Motion',
    description: 'Disables all animations, transitions, and motion effects.',
    whoHelps:    'Helps users with vestibular disorders, ADHD, or motion sensitivity.',
  },
]

export default function AccessibilitySettingsView({
  initialSettings,
  userId,
}: {
  initialSettings: AccessibilitySettings
  userId:          string
}) {
  const [settings, setSettings] = useState<AccessibilitySettings>(initialSettings)
  const [pending,  start]       = useTransition()
  const [saved,    setSaved]    = useState(false)

  function update(patch: Partial<AccessibilitySettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    applyToHtml(next)
    setSaved(false)
    start(async () => {
      await saveAccessibilitySettings(userId, patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function resetAll() {
    setSettings({ ...ACCESSIBILITY_DEFAULTS })
    applyToHtml(ACCESSIBILITY_DEFAULTS)
    setSaved(false)
    start(async () => {
      await saveAccessibilitySettings(userId, { ...ACCESSIBILITY_DEFAULTS })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const anyActive = hasActiveSettings(settings)

  return (
    <div className="space-y-4">
      {/* Toggle settings */}
      {SETTINGS.map(({ key, iconName, label, description, whoHelps }) => (
        <div
          key={key}
          className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            settings[key] ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <Icon name={iconName} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-1">
              <label htmlFor={key} className="text-[14px] font-semibold text-gray-900 cursor-pointer">
                {label}
              </label>
              <Toggle id={key} checked={settings[key]} onChange={v => update({ [key]: v })} />
            </div>
            <p className="text-[12px] text-gray-500 mb-1">{description}</p>
            <p className="text-[11px] text-blue-600 font-medium">{whoHelps}</p>
          </div>
        </div>
      ))}

      {/* Line spacing */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            settings.lineSpacing !== 'normal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <Icon name="format_align_left" size="md" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-gray-900 mb-1">Line Spacing</p>
            <p className="text-[12px] text-gray-500 mb-1">
              Increases the space between lines of text to improve readability.
            </p>
            <p className="text-[11px] text-blue-600 font-medium mb-4">
              Helps users with dyslexia, ADHD, or visual tracking difficulties.
            </p>
            <div className="flex gap-2">
              {(['normal', 'wide', 'wider'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => update({ lineSpacing: opt })}
                  className={`flex-1 py-2 text-[13px] font-semibold rounded-xl border transition-colors ${
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
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={resetAll}
          disabled={!anyActive || pending}
          className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
        >
          <Icon name="loop" size="sm" />
          Reset all to defaults
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-green-600 font-medium">
            <Icon name="check_circle" size="sm" />
            Saved
          </span>
        )}
        {pending && !saved && (
          <span className="text-[12px] text-gray-400">Saving…</span>
        )}
      </div>
    </div>
  )
}
