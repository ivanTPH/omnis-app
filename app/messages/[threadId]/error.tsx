'use client'
import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'

export default function ThreadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-sm px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-xl mb-4">
          <Icon name="error" size="md" className="text-red-500" />
        </div>
        <h2 className="text-section-header mb-2">Couldn&apos;t load this conversation</h2>
        <p className="text-sm text-gray-500 mb-5">
          There was a problem fetching this thread. It may have been deleted or you may not have access.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">Ref: {error.digest}</p>
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
