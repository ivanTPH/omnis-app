'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default function HelpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[HelpPage] error:', error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 py-20 text-center px-6">
      <Icon name="help_outline" size="lg" className="text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-700">Could not load the help centre</h2>
      <p className="text-sm text-gray-500">Something went wrong. Try refreshing the page.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Try again
        </button>
        <Link href="/dashboard" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
