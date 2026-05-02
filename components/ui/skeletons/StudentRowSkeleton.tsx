export function StudentRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="skeleton-avatar" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="skeleton-text w-2/5" />
        <div className="skeleton-text-sm w-1/4" />
      </div>
      <div className="skeleton-badge" />
    </div>
  )
}

export function StudentListSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <StudentRowSkeleton key={i} />
      ))}
    </div>
  )
}
