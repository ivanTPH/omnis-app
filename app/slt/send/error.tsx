'use client'

export default function SltSendError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-12 text-center">
      <div>
        <p className="text-[14px] font-semibold text-gray-800 mb-2">Failed to load SEND dashboard</p>
        <p className="text-[12px] text-gray-400 mb-4">{error.message}</p>
        <button onClick={reset} className="text-[12px] text-purple-600 hover:underline">Try again</button>
      </div>
    </div>
  )
}
