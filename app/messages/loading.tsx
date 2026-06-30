export default function MessagesLoading() {
  return (
    <div className="flex h-full min-h-0">
      {/* Left panel — thread list skeleton */}
      <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-7 w-14 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 divide-y divide-gray-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3 animate-pulse">
              <div className="w-9 h-9 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>
              <div className="h-2.5 w-8 bg-gray-100 rounded shrink-0 mt-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — empty placeholder */}
      <div className="flex-1 min-w-0 bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 opacity-20">
          <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse" />
          <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
