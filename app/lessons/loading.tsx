export default function LessonsLoading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-44 bg-gray-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
          <div className="h-8 w-28 bg-gray-100 rounded-lg" />
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-5">
        <div className="h-9 flex-1 bg-gray-100 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-lg" />
        <div className="h-9 w-28 bg-gray-100 rounded-lg" />
      </div>

      {/* 5-day grid */}
      <div className="grid grid-cols-5 gap-3">
        {[...Array(5)].map((_, col) => (
          <div key={col} className="space-y-2">
            <div className="h-8 bg-gray-200 rounded-lg" />
            {[...Array(3)].map((_, row) => (
              <div key={row} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
                <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
