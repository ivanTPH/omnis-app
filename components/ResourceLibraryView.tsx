'use client'

import { useState, useMemo } from 'react'
import { useRouter }          from 'next/navigation'
import Icon                   from '@/components/ui/Icon'
import type { ResourceLibraryItem } from '@/app/actions/lessons'

const TYPE_ICONS: Record<string, string> = {
  PLAN:      'description',
  SLIDES:    'slideshow',
  WORKSHEET: 'assignment',
  VIDEO:     'play_circle',
  LINK:      'link',
  OTHER:     'attach_file',
}

const TYPE_COLORS: Record<string, string> = {
  PLAN:      'bg-blue-100 text-blue-700',
  SLIDES:    'bg-violet-100 text-violet-700',
  WORKSHEET: 'bg-green-100 text-green-700',
  VIDEO:     'bg-red-100 text-red-700',
  LINK:      'bg-amber-100 text-amber-700',
  OTHER:     'bg-gray-100 text-gray-600',
}

const TYPE_CHIPS = [
  { key: undefined,    label: 'All' },
  { key: 'PLAN',       label: 'Lesson Plans' },
  { key: 'SLIDES',     label: 'Slides' },
  { key: 'WORKSHEET',  label: 'Worksheets' },
  { key: 'VIDEO',      label: 'Videos' },
  { key: 'LINK',       label: 'Links' },
]

function SendScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'
  return (
    <span className={`text-[10px] font-semibold ${color} flex items-center gap-0.5`}>
      <Icon name="accessibility_new" size="sm" />{score}
    </span>
  )
}

function relativeTime(d: Date) {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ResourceLibraryView({
  resources,
  initialType,
  initialQuery,
}: {
  resources:    ResourceLibraryItem[]
  initialType?: string
  initialQuery?: string
}) {
  const router = useRouter()
  const [activeType, setActiveType] = useState<string | undefined>(
    initialType && initialType !== 'all' ? initialType : undefined
  )
  const [search, setSearch] = useState(initialQuery ?? '')

  const filtered = useMemo(() => {
    let items = resources
    if (activeType) items = items.filter(r => r.type === activeType)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(r =>
        r.label.toLowerCase().includes(q) ||
        (r.subject ?? '').toLowerCase().includes(q) ||
        (r.lessonTitle ?? '').toLowerCase().includes(q)
      )
    }
    return items
  }, [resources, activeType, search])

  function handleSearch(q: string) {
    setSearch(q)
    const params = new URLSearchParams()
    if (activeType) params.set('type', activeType)
    if (q.trim())   params.set('q', q.trim())
    router.replace(`/resources${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  function handleType(type: string | undefined) {
    setActiveType(type)
    const params = new URLSearchParams()
    if (type)          params.set('type', type)
    if (search.trim()) params.set('q', search.trim())
    router.replace(`/resources${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-page-title">Resource Library</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">{resources.length} resource{resources.length !== 1 ? 's' : ''} in your school library</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, subject or lesson…"
          className="w-full pl-9 pr-4 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {TYPE_CHIPS.map(chip => {
          const active = activeType === chip.key
          const count  = chip.key ? resources.filter(r => r.type === chip.key).length : resources.length
          return (
            <button
              key={String(chip.key)}
              type="button"
              onClick={() => handleType(chip.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {chip.label}
              <span className={`text-[10px] ${active ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="folder_open" size="lg" className="mx-auto mb-3 text-gray-300" />
          <p>No resources match this filter.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Resource</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden md:table-cell">Lesson / Subject</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">SEND</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800 min-w-0"
                      >
                        <Icon name={TYPE_ICONS[r.type] ?? 'attach_file'} size="sm" className="shrink-0 text-gray-400" />
                        <span className="truncate max-w-[200px]">{r.label}</span>
                        <Icon name="open_in_new" size="sm" className="shrink-0 text-gray-400" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 font-medium text-gray-800 min-w-0">
                        <Icon name={TYPE_ICONS[r.type] ?? 'attach_file'} size="sm" className="shrink-0 text-gray-400" />
                        <span className="truncate max-w-[200px]">{r.label}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                    {r.lessonTitle ? (
                      <span className="max-w-[180px] truncate block">{r.lessonTitle}
                        {r.subject && <span className="text-gray-400 ml-1">· {r.subject}</span>}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">Standalone</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <SendScoreBadge score={r.sendScore} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{relativeTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
