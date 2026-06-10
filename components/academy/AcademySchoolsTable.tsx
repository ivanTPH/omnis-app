'use client'

import Icon from '@/components/ui/Icon'
import type { AcademySchoolRow } from '@/app/actions/academy'

function ago(date: Date | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const PHASE_LABEL: Record<string, string> = {
  primary: 'Primary', secondary: 'Secondary', 'all-through': 'All-through',
  special: 'Special', pru: 'PRU', other: 'Other',
}

export default function AcademySchoolsTable({ schools }: { schools: AcademySchoolRow[] }) {
  if (schools.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
        No schools yet.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-500">School</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Phase</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">Students</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">Staff</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">SEND</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">ILPs</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">EHCPs</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">Open Concerns</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">MIS Sync</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Setup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {schools.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Icon name="business" size="sm" className="text-gray-400 shrink-0" />
                    {s.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.phase ? PHASE_LABEL[s.phase] ?? s.phase : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 font-medium">
                  {s.studentCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 font-medium">
                  {s.staffCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={s.sendStudents > 0 ? 'text-purple-700 font-medium' : 'text-gray-400'}>
                    {s.sendStudents > 0 ? s.sendStudents.toLocaleString() : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={s.activeIlps > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}>
                    {s.activeIlps > 0 ? s.activeIlps : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={s.ehcps > 0 ? 'text-rose-700 font-medium' : 'text-gray-400'}>
                    {s.ehcps > 0 ? s.ehcps : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {s.openConcerns > 0 ? (
                    <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                      <Icon name="report_problem" size="sm" />
                      {s.openConcerns}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-[11px] ${
                    !s.lastSync ? 'text-gray-400' :
                    Date.now() - new Date(s.lastSync).getTime() > 14 * 86_400_000
                      ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    <Icon name={s.lastSync ? 'sync' : 'sync_disabled'} size="sm" />
                    {ago(s.lastSync)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {s.onboardedAt ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-[11px]">
                      <Icon name="check_circle" size="sm" />
                      {new Date(s.onboardedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-[11px]">
                      <Icon name="pending" size="sm" />
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
