export default function AttendanceLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-44 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-60 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-100 rounded-lg" />
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="h-7 w-12 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Year-group table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="h-4 w-44 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_60px_60px_60px] gap-4 items-center px-5 py-3">
              <div className="h-4 w-14 bg-gray-200 rounded" />
              <div className="h-1.5 w-full bg-gray-100 rounded-full" />
              <div className="h-4 w-10 bg-gray-100 rounded text-right" />
              <div className="h-4 w-10 bg-gray-100 rounded text-right" />
              <div className="h-4 w-10 bg-gray-100 rounded text-right" />
            </div>
          ))}
        </div>
      </div>

      {/* Below 90% student list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="h-4 w-36 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-7 w-24 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
