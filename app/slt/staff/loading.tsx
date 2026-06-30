export default function SltStaffLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-44 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-56 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-28 bg-gray-100 rounded-lg" />
      </div>

      {/* Staff table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_90px_90px_80px_70px_80px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded w-3/4" />
          ))}
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_90px_90px_80px_70px_80px] gap-4 items-center px-5 py-3">
              <div className="space-y-1">
                <div className="h-3.5 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-12 bg-gray-100 rounded-full" />
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-8 bg-gray-100 rounded" />
              <div className="h-4 w-10 bg-gray-100 rounded" />
              <div className="h-7 w-20 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
