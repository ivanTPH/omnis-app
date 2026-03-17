'use client'

import { useState, useEffect, useTransition } from 'react'
import { Accessibility } from 'lucide-react'
import AccessibilityPanel from './AccessibilityPanel'
import { getAccessibilitySettings } from '@/app/actions/accessibility'
import { ACCESSIBILITY_DEFAULTS, hasActiveSettings, settingsToClasses, type AccessibilitySettings } from '@/lib/accessibility'

export default function AccessibilityToolbar({ userId }: { userId: string | null }) {
  const [open,     setOpen]     = useState(false)
  const [settings, setSettings] = useState<AccessibilitySettings>(ACCESSIBILITY_DEFAULTS)
  const [loaded,   setLoaded]   = useState(false)
  const [, start] = useTransition()

  // Load settings on mount and apply classes to <html>
  useEffect(() => {
    if (!userId) { setLoaded(true); return }
    start(async () => {
      try {
        const s = await getAccessibilitySettings(userId)
        setSettings(s)
        setLoaded(true)
        // Reconcile with server-applied classes (idempotent)
        const el = document.documentElement
        el.classList.remove(
          'dyslexia-font', 'high-contrast', 'large-text',
          'reduced-motion', 'line-spacing-wide', 'line-spacing-wider',
        )
        const classes = settingsToClasses(s)
        if (classes) el.classList.add(...classes.split(' '))
      } catch (err) {
        console.error('[AccessibilityToolbar] settings load failed:', err)
        setLoaded(true)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const active = hasActiveSettings(settings)

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Accessibility settings"
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
      >
        <Accessibility size={18} />
        {loaded && active && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white" />
        )}
      </button>

      {/* Slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-white shadow-xl border-l border-gray-200 flex flex-col">
            {userId ? (
              <AccessibilityPanel
                initialSettings={settings}
                userId={userId}
                onClose={() => setOpen(false)}
              />
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h2 className="text-[14px] font-bold text-gray-900">Accessibility</h2>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                    <span className="text-[13px]">✕</span>
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-center p-6">
                  <p className="text-[12px] text-gray-400 text-center">
                    Sign in to save accessibility preferences across devices.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
