export default function ClassesLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8">
      <div className="mb-5">
        <div className="h-6 w-32 bg-gray-100 rounded-lg animate-pulse mb-1.5" />
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-4 h-4 bg-gray-100 rounded animate-pulse shrink-0" />
            <div className="h-5 w-10 bg-gray-100 rounded-full animate-pulse shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
