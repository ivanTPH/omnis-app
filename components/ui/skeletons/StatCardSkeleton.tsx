export function StatCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
      <div className="skeleton-text-sm w-1/3" />
      <div className="skeleton h-8 w-1/2 rounded" />
      <div className="skeleton-text-sm w-1/4" />
    </div>
  )
}
