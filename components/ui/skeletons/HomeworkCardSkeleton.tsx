export function HomeworkCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="skeleton-text-lg" />
        <div className="skeleton-badge" />
      </div>
      <div className="skeleton-text-sm w-2/3" />
      <div className="skeleton-btn ml-auto" />
    </div>
  )
}
