export default function AdminUsersLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-36 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-48 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="h-9 w-32 bg-gray-100 rounded-lg" />
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-full" />
        ))}
      </div>

      {/* Search */}
      <div className="h-10 w-72 bg-gray-100 rounded-lg mb-5" />

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded w-3/4" />
          ))}
        </div>
        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 items-center px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
              <div className="h-3.5 w-32 bg-gray-100 rounded" />
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
              <div className="flex gap-1.5">
                <div className="h-7 w-7 bg-gray-100 rounded" />
                <div className="h-7 w-7 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
