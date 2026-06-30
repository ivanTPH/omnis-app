export default function TeacherAnalyticsLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-44 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-56 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-36 bg-gray-100 rounded-lg" />
      </div>

      {/* Teacher selector */}
      <div className="h-10 w-72 bg-gray-100 rounded-lg mb-6" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="h-8 w-12 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Class table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="h-4 w-36 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_90px_80px_70px] gap-4 items-center px-5 py-3">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-12 bg-gray-100 rounded-full" />
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-8 bg-gray-100 rounded" />
              <div className="h-4 w-10 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Bloom's panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="h-4 w-36 bg-gray-200 rounded mb-4" />
        <div className="flex gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-6 w-20 bg-gray-100 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
