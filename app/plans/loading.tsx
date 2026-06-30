export default function PlansLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Page header */}
      <div className="mb-6">
        <div className="h-6 w-32 bg-gray-200 rounded-lg" />
        <div className="h-4 w-48 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-100 rounded-lg" />
        ))}
      </div>

      {/* Plan rows */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-gray-200 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
                <div className="h-5 w-28 bg-gray-100 rounded-full" />
              </div>
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded shrink-0" />
            <div className="h-8 w-20 bg-gray-100 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
