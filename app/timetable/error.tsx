'use client'
import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'

export default function TimetableError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <Icon name="event_busy" size="lg" className="text-gray-300 mb-3" />
      <p className="text-[14px] font-semibold text-gray-700 mb-1">Could not load timetable</p>
      <p className="text-[12px] text-gray-400 mb-4">There was a problem fetching your schedule.</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-[12px] font-semibold rounded-xl bg-gray-800 text-white hover:bg-gray-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
