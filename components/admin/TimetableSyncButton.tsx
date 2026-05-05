'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function TimetableSyncButton() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSync() {
    setStatus('syncing')
    setMessage(null)
    try {
      const res = await fetch('/api/wonde/sync', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setMessage(json.error ?? `Sync failed (${res.status})`)
      } else {
        setStatus('done')
        setMessage(json.message ?? 'Sync complete — refresh to see updated timetable')
      }
    } catch {
      setStatus('error')
      setMessage('Network error — please try again')
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={status === 'syncing'}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <Icon
          name="sync"
          size="sm"
          className={status === 'syncing' ? 'animate-spin' : ''}
        />
        {status === 'syncing' ? 'Syncing…' : 'Sync from MIS'}
      </button>
      {message && (
        <p className={`text-[12px] ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
