'use client'
export default function AcademyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-gray-600">Something went wrong loading the academy dashboard.</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
        Try again
      </button>
    </div>
  )
}
