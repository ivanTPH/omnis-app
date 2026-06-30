export default function DetentionsLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-44 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-32 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded-lg shrink-0" />
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 mb-5">
        {['Today', 'Upcoming', 'Missed', 'Completed'].map(s => (
          <div key={s} className="h-8 w-24 bg-gray-100 rounded-lg" />
        ))}
      </div>

      {/* Rows */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-44 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-16 bg-gray-100 rounded-full shrink-0" />
              <div className="h-7 w-20 bg-gray-100 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
