export default function HomeworkLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-36 bg-gray-200 rounded-lg" />
        <div className="h-4 w-28 bg-gray-100 rounded mt-2" />
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-9 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="h-9 bg-gray-100 rounded-lg mt-3" />
      </div>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="h-8 w-12 bg-gray-200 rounded mx-auto" />
            <div className="h-3 w-20 bg-gray-100 rounded mt-2 mx-auto" />
          </div>
        ))}
      </div>

      {/* List skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
            <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-64 bg-gray-200 rounded" />
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
            <div className="w-12 h-8 bg-gray-100 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
