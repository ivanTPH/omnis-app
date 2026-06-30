export default function HoyWelfareLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-40 bg-gray-200 rounded-lg" />
          <div className="h-3.5 w-48 bg-gray-100 rounded mt-1.5" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-gray-100 rounded-lg" />
          <div className="h-8 w-36 bg-gray-100 rounded-full" />
        </div>
      </div>

      {/* Section panels */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="h-4 w-36 bg-gray-200 rounded" />
            <div className="h-5 w-10 bg-gray-100 rounded-full" />
          </div>
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-48 bg-gray-100 rounded" />
                </div>
                <div className="h-5 w-16 bg-gray-100 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
