'use client'

export default function SendCaseloadError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
      <p className="text-gray-600">Failed to load SEND caseload.</p>
      <p className="text-xs text-gray-400">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
    </div>
  )
}
