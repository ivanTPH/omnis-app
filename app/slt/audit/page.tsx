import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSchoolAuditLog } from '@/app/actions/admin'
import { AUDIT_CATEGORIES } from '@/lib/audit-categories'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'

const ACTION_COLOR: Record<string, string> = {
  HOMEWORK_CREATED:       'bg-blue-100 text-blue-700',
  HOMEWORK_PUBLISHED:     'bg-blue-100 text-blue-700',
  SUBMISSION_GRADED:      'bg-green-100 text-green-700',
  GRADE_OVERRIDDEN:       'bg-amber-100 text-amber-700',
  ILP_CREATED:            'bg-purple-100 text-purple-700',
  ILP_ACTIVATED:          'bg-purple-100 text-purple-700',
  ILP_REVIEWED:           'bg-purple-100 text-purple-700',
  SEND_STATUS_CHANGED:    'bg-purple-100 text-purple-700',
  K_PLAN_UPDATED:         'bg-emerald-100 text-emerald-700',
  AI_ILP_GENERATED:       'bg-violet-100 text-violet-700',
  LESSON_PUBLISHED:       'bg-indigo-100 text-indigo-700',
  RESOURCE_UPLOADED:      'bg-teal-100 text-teal-700',
  WONDE_SYNC_COMPLETED:   'bg-cyan-100 text-cyan-700',
  USER_SETTINGS_CHANGED:  'bg-gray-100 text-gray-600',
  HOMEWORK_ADAPTED:       'bg-orange-100 text-orange-700',
  TA_NOTE_ADDED:          'bg-amber-100 text-amber-700',
}

const CATEGORY_CHIPS = [
  { key: undefined,    label: 'All events',  icon: 'list' },
  { key: 'send',       label: 'SEND & ILP',  icon: 'accessibility_new' },
  { key: 'homework',   label: 'Homework',    icon: 'assignment' },
  { key: 'users',      label: 'Users',       icon: 'people' },
  { key: 'lessons',    label: 'Lessons',     icon: 'menu_book' },
  { key: 'system',     label: 'System',      icon: 'settings' },
] as const

const DATE_CHIPS = [
  { days: 1,         label: 'Today' },
  { days: 7,         label: 'This week' },
  { days: 30,        label: 'This month' },
  { days: undefined, label: 'All time' },
] as const

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

function relativeTime(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function buildHref(base: string, params: { page?: number; category?: string; days?: number }) {
  const sp = new URLSearchParams()
  if (params.page)     sp.set('page', String(params.page))
  if (params.category) sp.set('category', params.category)
  if (params.days)     sp.set('days', String(params.days))
  const qs = sp.toString()
  return `${base}${qs ? `?${qs}` : ''}`
}

const PAGE_SIZE = 50
const BASE = '/slt/audit'

export default async function SltAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; days?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const sp = await searchParams
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0)
  // SLT defaults to SEND category; admin audit defaults to all
  const category = sp.category !== undefined
    ? (AUDIT_CATEGORIES[sp.category] ? sp.category : undefined)
    : 'send'
  const days = sp.days ? Math.max(1, parseInt(sp.days, 10) || 0) || undefined : undefined

  const { entries, total } = await getSchoolAuditLog(page, PAGE_SIZE, category, days)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-page-title">Audit Log</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{total.toLocaleString()} event{total !== 1 ? 's' : ''} recorded</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/api/export/audit-log${category || days ? `?${new URLSearchParams({ ...(category ? { category } : {}), ...(days ? { days: String(days) } : {}) })}` : ''}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <Icon name="download" size="sm" />
              Export CSV
            </Link>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Icon name="lock" size="sm" />
              Immutable — read only
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_CHIPS.map(chip => {
              const active = category === chip.key
              return (
                <Link
                  key={chip.label}
                  href={buildHref(BASE, { category: chip.key, days })}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition
                    ${active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  <Icon name={chip.icon} size="sm" />
                  {chip.label}
                </Link>
              )
            })}
          </div>
          <div className="w-px h-5 bg-gray-200 hidden sm:block" />
          <div className="flex gap-1.5">
            {DATE_CHIPS.map(chip => {
              const active = days === chip.days
              return (
                <Link
                  key={chip.label}
                  href={buildHref(BASE, { category, days: chip.days })}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition
                    ${active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {chip.label}
                </Link>
              )
            })}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="history" size="lg" className="mx-auto mb-3 text-gray-300" />
            <p>No audit events for this filter.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 w-28">When</th>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[12px] text-gray-400">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 0 && (
                <Link
                  href={buildHref(BASE, { page: page - 1, category, days })}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <Icon name="chevron_left" size="sm" />Previous
                </Link>
              )}
              {page < totalPages - 1 && (
                <Link
                  href={buildHref(BASE, { page: page + 1, category, days })}
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
