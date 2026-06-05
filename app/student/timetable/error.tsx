'use client'
import AppShell from '@/components/AppShell'

export default function TimetableError({ reset }: { reset: () => void }) {
  return (
    <AppShell role="STUDENT" firstName="" lastName="" schoolName="">
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">Could not load your timetable.</p>
        <button onClick={reset} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Try again
        </button>
      </div>
    </AppShell>
  )
}
