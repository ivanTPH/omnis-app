import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'
import { getSchoolAuditLog } from '@/app/actions/admin'

const ACTION_COLOR: Record<string, string> = {
  HOMEWORK_CREATED:       'bg-blue-100 text-blue-700',
  HOMEWORK_PUBLISHED:     'bg-blue-100 text-blue-700',
  SUBMISSION_GRADED:      'bg-green-100 text-green-700',
  GRADE_OVERRIDDEN:       'bg-amber-100 text-amber-700',
  ILP_CREATED:            'bg-purple-100 text-purple-700',
  SEND_STATUS_CHANGED:    'bg-purple-100 text-purple-700',
  LESSON_PUBLISHED:       'bg-indigo-100 text-indigo-700',
  WONDE_SYNC_COMPLETED:   'bg-cyan-100 text-cyan-700',
  RESOURCE_UPLOADED:      'bg-teal-100 text-teal-700',
  USER_SETTINGS_CHANGED:  'bg-gray-100 text-gray-600',
  HOMEWORK_ADAPTED:       'bg-orange-100 text-orange-700',
}

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAGE_SIZE = 50

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const sp   = await searchParams
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0)
  const { entries, total } = await getSchoolAuditLog(page, PAGE_SIZE)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{total.toLocaleString()} event{total !== 1 ? 's' : ''} recorded</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Icon name="lock" size="sm" />
            Immutable — read only
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="history" size="lg" className="mx-auto mb-3 text-gray-300" />
            <p>No audit events yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 w-32">When</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Action</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Actor</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Target</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap" title={new Date(e.createdAt).toLocaleString('en-GB')}>
                      {relativeTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${ACTION_COLOR[e.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {actionLabel(e.action)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                      {e.actorName}
                      <span className="text-gray-400 ml-1">({e.actorRole.replace(/_/g, ' ').toLowerCase()})</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      <span className="font-medium text-gray-700">{e.targetType}</span>
                      <span className="text-gray-400 ml-1 font-mono text-[10px]">{e.targetId.slice(0, 12)}…</span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-gray-400 max-w-xs truncate">
                      {e.metadata ? Object.entries(e.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[12px] text-gray-400">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 0 && (
                <Link
                  href={`?page=${page - 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <Icon name="chevron_left" size="sm" />Previous
                </Link>
              )}
              {page < totalPages - 1 && (
                <Link
                  href={`?page=${page + 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Next<Icon name="chevron_right" size="sm" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
