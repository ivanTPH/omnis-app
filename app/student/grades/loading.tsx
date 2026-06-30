export default function StudentGradesLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      {/* Page header */}
      <div className="mb-6">
        <div className="h-6 w-32 bg-gray-200 rounded-lg" />
        <div className="h-3.5 w-48 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Subject cards */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
              {/* Sparkline placeholder */}
              <div className="w-20 h-7 bg-gray-100 rounded" />
              {/* Grade pill */}
              <div className="h-6 w-14 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
