'use client'
import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

export default function HomeworkError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    console.error('[HomeworkPage] error boundary triggered:', error?.message)
  }, [error])

  function handleRetry() {
    // Refresh server data first, then reset the boundary once the transition completes.
    startTransition(() => {
      router.refresh()
    })
    setTimeout(reset, 200)
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-xl mb-4">
          <Icon name="error" size="md" className="text-red-500" />
        </div>
        <h2 className="text-section-header mb-2">Couldn&apos;t load homework</h2>
        <p className="text-sm text-gray-500 mb-5">
          There was a problem fetching your homework data. This is usually a temporary issue.
        </p>
        <button
          onClick={handleRetry}
          disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          <Icon name="refresh" size="sm" className={pending ? 'animate-spin' : ''} />
          {pending ? 'Refreshing…' : 'Try again'}
        </button>
      </div>
    </div>
  )
}
