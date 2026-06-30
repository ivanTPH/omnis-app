export default function HoyAbsenceLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-36 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-48 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-32 bg-gray-100 rounded-lg shrink-0" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="h-7 w-10 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Flagged students table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_100px_90px_80px] gap-4 items-center px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gray-200 rounded-full shrink-0" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
              </div>
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-3 w-14 bg-gray-100 rounded" />
              <div className="h-1.5 w-full bg-gray-100 rounded-full" />
              <div className="h-8 w-20 bg-gray-100 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
