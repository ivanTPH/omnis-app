'use client'
import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminDashboard] error boundary caught:', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
        <Icon name="error" size="lg" className="text-red-400 mx-auto mb-4" />
        <h1 className="text-[17px] font-semibold text-gray-900 mb-2">Dashboard unavailable</h1>
        <p className="text-[13px] text-gray-500 mb-6">
          Something went wrong loading the admin dashboard.
          {error.digest && (
            <span className="block mt-1 font-mono text-[11px] text-gray-400">
              Digest: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <Icon name="refresh" size="sm" />
          Try again
        </button>
      </div>
    </div>
  )
}
