'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

const STORAGE_KEY  = 'omnis-onboarding-v1'
const DISMISS_KEY  = 'omnis-onboarding-dismissed-v1'

type Item = { id: string; label: string; href: string; roles: string[] }

const ITEMS: Item[] = [
  { id: 'homework',    label: 'Create your first homework',         href: '/homework',            roles: ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR'] },
  { id: 'prediction',  label: 'Set a predicted grade for a student', href: '/analytics',           roles: ['TEACHER','HEAD_OF_DEPT'] },
  { id: 'warning',     label: 'Review early warning flags',          href: '/senco/early-warning', roles: ['SENCO'] },
  { id: 'ilp',         label: 'Check ILP records for your students', href: '/senco/ilp',           roles: ['SENCO'] },
  { id: 'revision',    label: 'Create a revision program',           href: '/revision-program/new', roles: ['TEACHER','HEAD_OF_DEPT'] },
  { id: 'help',        label: 'Explore the Help section',            href: '/help',                roles: ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SCHOOL_ADMIN','SLT'] },
]

export default function OnboardingChecklist({ role }: { role: string }) {
  const [dismissed, setDismissed] = useState(true)   // start hidden to avoid flash
  const [checked,   setChecked]   = useState<Set<string>>(new Set())
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    const isDismissed = localStorage.getItem(DISMISS_KEY) === '1'
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
    setChecked(new Set(stored))
    setDismissed(isDismissed)
  }, [])

  function toggleItem(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  if (!mounted || dismissed) return null

  const items = ITEMS.filter(i => i.roles.includes(role))
  if (items.length === 0) return null

  const doneCount = items.filter(i => checked.has(i.id)).length
  const allDone   = doneCount === items.length

  return (
    <div className="fixed bottom-36 right-4 z-50 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
        <div>
          <p className="text-sm font-semibold text-white">Getting started</p>
          <p className="text-[10px] text-blue-200">{doneCount}/{items.length} complete</p>
        </div>
        <button onClick={dismiss} className="text-white/70 hover:text-white transition-colors" aria-label="Dismiss">
          <Icon name="close" size="sm" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-blue-100">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%` }}
        />
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-50">
        {items.map(item => {
          const done = checked.has(item.id)
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                onClick={() => toggleItem(item.id)}
                className={`shrink-0 w-5 h-5 rounded border transition-colors flex items-center justify-center ${
                  done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                }`}
                aria-label={done ? 'Mark incomplete' : 'Mark complete'}
              >
                {done && <Icon name="check" size="sm" />}
              </button>
              <Link
                href={item.href}
                className={`flex-1 text-[12px] transition-colors hover:text-blue-600 ${
                  done ? 'text-gray-400 line-through' : 'text-gray-700'
                }`}
              >
                {item.label}
              </Link>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        {allDone ? (
          <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
            <Icon name="celebration" size="sm" /> All done — you are ready!
          </p>
        ) : (
          <Link href="/help" className="text-[11px] text-blue-600 hover:underline flex items-center gap-1">
            <Icon name="help_outline" size="sm" /> View full help guide
          </Link>
        )}
        <button onClick={dismiss} className="text-[10px] text-gray-400 hover:text-gray-600">
          Dismiss
        </button>
      </div>
    </div>
  )
}
