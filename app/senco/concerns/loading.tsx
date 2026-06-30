export default function SencoConcernsLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-40 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-52 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded-lg shrink-0" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-full" />
        ))}
      </div>

      {/* Concern cards */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-200 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-48 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
                <div className="h-6 w-16 bg-gray-100 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
