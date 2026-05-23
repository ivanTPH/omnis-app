export default function DashboardLoading() {
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
          <div className="h-7 w-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-white border border-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white border border-gray-100 rounded-2xl animate-pulse" />
          <div className="h-48 bg-white border border-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
