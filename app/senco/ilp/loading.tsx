export default function SencoIlpLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-32 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-44 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="h-9 w-28 bg-gray-200 rounded-lg shrink-0" />
      </div>

      {/* Filter + search row */}
      <div className="flex gap-3 mb-5">
        <div className="h-9 flex-1 bg-gray-100 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-lg" />
      </div>

      {/* ILP rows */}
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-gray-200 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
                <div className="h-5 w-24 bg-gray-100 rounded-full" />
              </div>
            </div>
            <div className="h-4 w-20 bg-gray-100 rounded shrink-0" />
            <div className="h-4 w-4 bg-gray-100 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
