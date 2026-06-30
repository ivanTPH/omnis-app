export default function StudentHomeworkLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      {/* Page header */}
      <div className="mb-5">
        <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        <div className="h-3.5 w-24 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-full shrink-0" />
        ))}
      </div>

      {/* Homework list */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-64 bg-gray-200 rounded" />
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
            <div className="h-7 w-16 bg-gray-100 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
