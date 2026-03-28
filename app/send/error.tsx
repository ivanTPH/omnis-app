'use client'
import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'

export default function SendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-xl mb-4">
          <Icon name="error" size="md" className="text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Couldn&apos;t load SEND records</h2>
        <p className="text-sm text-gray-500 mb-5">
          There was a problem fetching SEND data. This is usually a temporary issue.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Icon name="refresh" size="sm" />
          Try again
        </button>
      </div>
    </div>
  )
}
