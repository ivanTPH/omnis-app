'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { getMyGoLiveStatus } from '@/app/actions/go-live'
import type { GoLiveStatus } from '@/lib/go-live'

const DISMISS_KEY = 'omnis.golive.dismissed'

/**
 * Shown to staff while their school has not yet gone live. Lists what is
 * still outstanding. Admins get links to fix each item; other staff see who
 * normally does it. Dismissed for the rest of the browser session; it comes
 * back on the next sign-in until the school is live.
 */
export default function GoLiveChecklistModal() {
  const [status, setStatus] = useState<(GoLiveStatus & { canManage: boolean }) | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    try { if (sessionStorage.getItem(DISMISS_KEY) === '1') return } catch { /* storage unavailable */ }
    getMyGoLiveStatus()
      .then(s => { if (!cancelled && s && !s.live) { setStatus(s); setOpen(true) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  if (!open || !status) return null
  const outstanding = status.items.filter(i => !i.done)

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="golive-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="rocket_launch" size="md" className="text-gray-700" />
            <h2 id="golive-title" className="text-[18px] font-bold text-gray-900">Omnis is not live yet</h2>
          </div>
          <p className="text-[13px] text-gray-600">
            Your school is still setting up. {status.requiredDone} of {status.requiredTotal} essential steps are done.
            Pupils and parents won’t be invited until everything essential is complete.
          </p>
        </div>
        <ul className="p-6 space-y-3">
          {outstanding.map(item => (
            <li key={item.key} className="flex gap-3">
              <Icon name={item.required ? 'radio_button_unchecked' : 'lightbulb'} size="sm" className={item.required ? 'text-amber-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
              <div className="text-[13px]">
                <p className="font-semibold text-gray-900">
                  {item.label}{!item.required && <span className="font-normal text-gray-400"> (recommended)</span>}
                </p>
                <p className="text-gray-600">{item.detail}</p>
                {status.canManage
                  ? <Link href={item.href} onClick={dismiss} className="text-blue-700 hover:underline">Sort this out</Link>
                  : <p className="text-gray-400">Usually done by: {item.who}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="px-6 pb-6 flex flex-wrap gap-2 justify-end">
          {status.canManage && (
            <Link href="/admin/go-live" onClick={dismiss} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold">
              Open go-live checklist
            </Link>
          )}
          <button onClick={dismiss} className="px-4 py-2 rounded-lg border border-gray-300 text-[13px] font-medium text-gray-700">
            {status.canManage ? 'Later' : 'OK, carry on setting up'}
          </button>
        </div>
      </div>
    </div>
  )
}
