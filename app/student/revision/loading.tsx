export default function StudentRevisionLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-6 w-40 bg-gray-200 rounded-lg" />
        <div className="h-3.5 w-56 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="h-7 w-10 bg-gray-200 rounded mx-auto" />
            <div className="h-3 w-20 bg-gray-100 rounded mt-2 mx-auto" />
          </div>
        ))}
      </div>

      {/* Exam list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="h-4 w-28 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 bg-gray-200 rounded" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-14 bg-gray-100 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Session grid placeholder */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 h-40" />
    </div>
  )
}
