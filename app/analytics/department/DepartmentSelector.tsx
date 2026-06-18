'use client'

import { useRouter } from 'next/navigation'

export default function DepartmentSelector({
  departments,
  selected,
}: {
  departments: string[]
  selected: string
}) {
  const router = useRouter()

  return (
    <select
      className="w-full sm:w-64 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      value={selected}
      onChange={e => router.push(`/analytics/department${e.target.value ? `?dept=${encodeURIComponent(e.target.value)}` : ''}`)}
    >
      <option value="">All departments</option>
      {departments.map(d => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  )
}
