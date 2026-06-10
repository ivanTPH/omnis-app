import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { ActivationByYear } from '@/app/actions/admin'

export default function ActivationPanel({
  breakdown,
  total,
  pending,
}: {
  breakdown: ActivationByYear
  total:     number
  pending:   number
}) {
  if (pending === 0) return null

  const pct = total > 0 ? Math.round((pending / total) * 100) : 0

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Icon name="schedule" size="md" className="text-amber-500" />
          <div>
            <p className="text-[14px] font-bold text-gray-900">Pending first login</p>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {pending} of {total} students have not yet activated their account
            </p>
          </div>
        </div>
        <Link
          href="/admin/users?filter=pending"
          className="shrink-0 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[12px] font-medium rounded-lg transition"
        >
          View all
        </Link>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-2 bg-green-400 rounded-full transition-all"
          style={{ width: `${100 - pct}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        {100 - pct}% activated
      </p>

      {/* Per year group breakdown */}
      {breakdown.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Pending by year group
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {breakdown.map(row => (
              <div
                key={row.yearGroup ?? 'unknown'}
                className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2"
              >
                <span className="text-[12px] text-gray-700">
                  {row.yearGroup != null ? `Year ${row.yearGroup}` : 'Unknown year'}
                </span>
                <span className="text-[12px] font-bold text-amber-700">
                  {row.pending}
                  <span className="text-[10px] font-normal text-gray-400 ml-0.5">/ {row.total}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-3">
        Ask form tutors to remind students to check their school email and click the activation link.
        You can resend emails individually from{' '}
        <Link href="/admin/users" className="text-blue-500 hover:underline">User Management</Link>.
      </p>
    </div>
  )
}
