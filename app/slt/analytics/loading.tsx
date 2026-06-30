export default function SltAnalyticsLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Page header */}
      <div className="mb-6">
        <div className="h-6 w-44 bg-gray-200 rounded-lg" />
        <div className="h-3.5 w-64 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Filter row */}
      <div className="flex gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-36 bg-gray-100 rounded-lg" />
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <div className="h-7 w-14 bg-gray-200 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Two-column: chart + breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 h-56" />
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 h-3.5 bg-gray-200 rounded" />
                <div className="h-5 w-12 bg-gray-100 rounded shrink-0" />
                <div className="h-3 w-20 bg-gray-100 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
