'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { SchoolHealthRow } from '@/app/actions/platform-admin'

function ago(date: Date | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function PlatformSchoolHealthTable({ rows }: { rows: SchoolHealthRow[] }) {
  if (rows.length === 0) return null

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        School Health
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-500">School</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500">Students</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">MIS Sync</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Onboarded</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500">Open Issues</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => {
                const syncStale = !r.lastSync || Date.now() - new Date(r.lastSync).getTime() > 14 * 86_400_000
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {r.name}
                      {!r.isActive && (
                        <span className="ml-2 text-[10px] text-gray-400 font-normal">(inactive)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.studentCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.staffCount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 ${syncStale ? 'text-amber-600' : 'text-green-600'}`}>
                        <Icon name={syncStale ? 'warning' : 'check_circle'} size="sm" />
                        {ago(r.lastSync)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.onboardedAt ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Icon name="check_circle" size="sm" />
                          {new Date(r.onboardedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1">
                          <Icon name="pending" size="sm" />
                          Not onboarded
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.openIssues > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                          <Icon name="error" size="sm" />
                          {r.openIssues}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href="/platform-admin/schools" className="text-[11px] text-blue-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
