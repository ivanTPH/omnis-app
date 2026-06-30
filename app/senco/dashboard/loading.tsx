export default function SencoDashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Page header */}
      <div>
        <div className="h-6 w-40 bg-gray-200 rounded-lg" />
        <div className="h-4 w-56 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
            <div className="divide-y divide-gray-50">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 bg-gray-200 rounded" />
                    <div className="h-3 w-48 bg-gray-100 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-gray-100 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
