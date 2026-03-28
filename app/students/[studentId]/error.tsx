'use client'
export default function StudentFileError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Failed to load student file.</p>
        <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Try again</button>
      </div>
    </div>
  )
}
