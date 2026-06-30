export default function HoyBehaviourLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-32 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-gray-100 rounded-lg" />
          <div className="h-8 w-28 bg-gray-100 rounded-lg" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="h-7 w-10 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 h-48" />

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7 w-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
              <div className="h-4 w-8 bg-gray-100 rounded shrink-0" />
              <div className="h-4 w-8 bg-gray-100 rounded shrink-0" />
              <div className="h-4 w-8 bg-gray-100 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
