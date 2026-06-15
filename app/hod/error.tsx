'use client'
export default function HodError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
      <p className="text-[14px] font-semibold text-gray-700 mb-2">Something went wrong</p>
      <button onClick={reset} className="text-[12px] text-blue-600 hover:underline">Try again</button>
    </div>
  )
}
