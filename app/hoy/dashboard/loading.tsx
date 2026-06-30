export default function HoyDashboardLoading() {
  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6 animate-pulse">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-6 w-52 bg-gray-200 rounded-lg" />
            <div className="h-3.5 w-64 bg-gray-100 rounded mt-1.5" />
          </div>
          <div className="h-8 w-32 bg-gray-100 rounded-lg shrink-0" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4">
              <div className="w-9 h-9 bg-gray-100 rounded-lg shrink-0" />
              <div className="space-y-2">
                <div className="h-6 w-10 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-20 bg-gray-200 rounded" />
                <div className="h-3 w-28 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <div className="h-4 w-36 bg-gray-200 rounded" />
              </div>
              <div className="divide-y divide-gray-100">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between px-5 py-3">
                    <div className="h-3.5 w-32 bg-gray-200 rounded" />
                    <div className="h-5 w-14 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
