export default function StudentAnalyticsLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Page header */}
      <div className="mb-6">
        <div className="h-6 w-44 bg-gray-200 rounded-lg" />
        <div className="h-3.5 w-60 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Filter row */}
      <div className="flex gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-36 bg-gray-100 rounded-lg" />
        ))}
      </div>

      {/* Student table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded w-3/4" />
          ))}
        </div>
        {/* Student rows */}
        <div className="divide-y divide-gray-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 items-center px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
              </div>
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="h-4 w-8 bg-gray-200 rounded" />
              <div className="w-20 h-6 bg-gray-100 rounded" />
              <div className="h-5 w-12 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
