export default function TimetableLoading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-6 w-40 bg-gray-200 rounded-lg" />
        <div className="h-3.5 w-32 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* 5-day timetable grid */}
      <div className="grid grid-cols-5 gap-3">
        {[...Array(5)].map((_, col) => (
          <div key={col} className="space-y-2">
            {/* Day header */}
            <div className="h-9 bg-gray-200 rounded-lg" />
            {/* Period blocks */}
            {[...Array(5)].map((_, row) => (
              <div key={row} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
                <div className="h-3 w-1/3 bg-gray-100 rounded" />
                <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
