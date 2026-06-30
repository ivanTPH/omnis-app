export default function HomeworkMarkingLoading() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden animate-pulse">
      {/* Left panel — student list */}
      <div className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded mt-1.5" />
        </div>
        {/* Filter chips */}
        <div className="px-3 py-2 flex gap-1.5 border-b border-gray-100">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 w-16 bg-gray-100 rounded-full" />
          ))}
        </div>
        {/* Student rows */}
        <div className="flex-1 divide-y divide-gray-100 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="w-7 h-7 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-7 bg-gray-100 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — submission view */}
      <div className="flex-1 min-w-0 bg-gray-50 flex flex-col p-6 gap-4 overflow-hidden">
        {/* Title */}
        <div className="h-5 w-64 bg-gray-200 rounded" />
        {/* Q&A cards */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-12 bg-blue-50 rounded-lg" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
          </div>
        ))}
        {/* Grade bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="flex gap-2">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="w-9 h-9 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
