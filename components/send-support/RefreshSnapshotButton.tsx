'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { refreshSupportSnapshot } from '@/app/actions/send-support'
import { useRouter } from 'next/navigation'

export default function RefreshSnapshotButton({ studentId }: { studentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)

  async function handleRefresh() {
    setLoading(true)
    try {
      const result = await refreshSupportSnapshot(studentId)
      if (result.success) {
        router.refresh()
        setToast('Snapshot refreshed')
      } else {
        setToast(result.error ?? 'Failed to refresh')
      }
    } finally {
      setLoading(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={loading}
        title="Regenerate support snapshot using latest K Plan / ILP"
        className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
      >
        {loading
          ? <Loader2 size={12} className="animate-spin" />
          : <RefreshCw size={12} />}
        Refresh snapshot
      </button>
      {toast && (
        <span className="text-[11px] text-blue-600 font-medium">{toast}</span>
      )}
    </div>
  )
}
