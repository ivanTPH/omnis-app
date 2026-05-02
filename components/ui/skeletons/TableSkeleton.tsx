export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`skeleton-text ${i === 0 ? 'w-3/4' : 'w-1/2'}`} />
        </td>
      ))}
    </tr>
  )
}

export function TableSkeleton({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </tbody>
  )
}
