export default function StudentDashboardLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-pulse">
      {/* Greeting */}
      <div>
        <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-32 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="h-7 w-8 bg-gray-200 rounded mx-auto" />
            <div className="h-3 w-16 bg-gray-100 rounded mt-2 mx-auto" />
          </div>
        ))}
      </div>

      {/* Section heading */}
      <div className="h-4 w-32 bg-gray-200 rounded" />

      {/* Homework cards */}
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-56 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
            <div className="h-7 w-16 bg-gray-100 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
