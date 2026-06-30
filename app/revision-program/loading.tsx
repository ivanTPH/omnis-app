export default function RevisionProgramLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8 animate-pulse">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-44 bg-gray-200 rounded-lg" />
          <div className="h-4 w-32 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-36 bg-gray-200 rounded-lg shrink-0" />
      </div>

      {/* Program cards */}
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-52 bg-gray-200 rounded" />
                <div className="h-3 w-36 bg-gray-100 rounded" />
                <div className="flex gap-2 mt-1">
                  <div className="h-5 w-20 bg-gray-100 rounded-full" />
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="h-8 w-20 bg-gray-100 rounded-lg" />
                <div className="h-8 w-8 bg-gray-100 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
