export default function AnalyticsLoading() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar skeleton */}
      <div className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col p-4 gap-3">
        <div className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse mb-4" />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="h-7 w-40 bg-gray-200 rounded-lg animate-pulse" />
          {/* Tab bar */}
          <div className="flex gap-3">
            <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-24 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          {/* Filter row */}
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-9 w-36 bg-white border border-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
          {/* Charts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="h-56 bg-white border border-gray-100 rounded-2xl animate-pulse" />
            <div className="h-56 bg-white border border-gray-100 rounded-2xl animate-pulse" />
          </div>
          {/* Table */}
          <div className="h-48 bg-white border border-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
