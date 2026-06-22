'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter }          from 'next/navigation'
import Icon                   from '@/components/ui/Icon'
import { toast, ToastContainer } from '@/components/ui/Toast'
import type { ResourceLibraryItem, LessonPickerItem } from '@/app/actions/lessons'
import { getLessonsForPicker, addLibraryResource }    from '@/app/actions/lessons'

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

// ── ResourcePreviewSlideOver ──────────────────────────────────────────────────

function ResourcePreviewSlideOver({
  resource,
  onClose,
}: {
  resource: ResourceLibraryItem
  onClose:  () => void
}) {
  const [lessons,       setLessons]       = useState<LessonPickerItem[] | null>(null)
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<string>('')
  const [adding,         setAdding]         = useState(false)

  const handleLoadLessons = useCallback(async () => {
    if (lessons !== null) return
    setLoadingLessons(true)
    try {
      const data = await getLessonsForPicker()
      setLessons(data)
    } finally {
      setLoadingLessons(false)
    }
  }, [lessons])

  async function handleAddToLesson() {
    if (!selectedLesson) return
    setAdding(true)
    try {
      await addLibraryResource(selectedLesson, resource.id)
      toast('Resource added to lesson')
      onClose()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to add resource', 'error')
    } finally {
      setAdding(false)
    }
  }

  const score = resource.sendScore
  const scoreColor = score == null ? 'text-gray-400'
    : score >= 70 ? 'text-green-600'
    : score >= 40 ? 'text-amber-600'
    : 'text-red-500'

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" />
      {/* Panel */}
      <div
        className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon name={TYPE_ICONS[resource.type] ?? 'attach_file'} size="sm" className="text-gray-400 shrink-0" />
              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_COLORS[resource.type] ?? 'bg-gray-100 text-gray-600'}`}>
                {resource.type}
              </span>
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 leading-snug">{resource.label}</h2>
            {resource.lessonTitle && (
              <p className="text-[12px] text-gray-400 mt-0.5">
                {resource.lessonTitle}{resource.subject ? ` · ${resource.subject}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600 shrink-0">
            <Icon name="close" size="md" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {/* SEND score */}
          {score != null && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Icon name="accessibility_new" size="sm" className={scoreColor} />
              <div>
                <p className="text-[11px] text-gray-400 font-medium">SEND Accessibility Score</p>
                <p className={`text-[18px] font-bold ${scoreColor}`}>{score}/100</p>
              </div>
              <p className="text-[11px] text-gray-400 ml-2">
                {score >= 70 ? 'Good accessibility' : score >= 40 ? 'Some accessibility features present' : 'Needs improvement'}
              </p>
            </div>
          )}

          {/* Open / download */}
          {resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Icon name="open_in_new" size="sm" />
              Open resource
            </a>
          ) : resource.fileKey ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-xl text-sm text-gray-600">
              <Icon name="attach_file" size="sm" />
              Uploaded file — open via the lesson it was added to
            </div>
          ) : null}

          {/* Add to lesson */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={handleLoadLessons}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
            >
              <span className="text-[13px] font-medium text-gray-700 flex items-center gap-2">
                <Icon name="add_circle" size="sm" className="text-blue-600" />
                Add to a lesson
              </span>
              {loadingLessons
                ? <Icon name="refresh" size="sm" className="animate-spin text-gray-400" />
                : <Icon name="expand_more" size="sm" className="text-gray-400" />
              }
            </button>
            {lessons !== null && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {lessons.length === 0 ? (
                  <p className="text-[12px] text-gray-400">No lessons found in the next 14 days. Add lessons via your Calendar first.</p>
                ) : (
                  <>
                    <select
                      value={selectedLesson}
                      onChange={e => setSelectedLesson(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a lesson…</option>
                      {lessons.map(l => (
                        <option key={l.id} value={l.id}>
                          {new Date(l.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {' — '}{l.title}{l.className ? ` (${l.className})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddToLesson}
                      disabled={!selectedLesson || adding}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      {adding
                        ? <><Icon name="refresh" size="sm" className="animate-spin" /> Adding…</>
                        : <><Icon name="add" size="sm" /> Add to lesson</>
                      }
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-[11px] text-gray-400 space-y-1 pt-2">
            <p>Added {relativeTime(resource.createdAt)}</p>
            {resource.lessonTitle && <p>From lesson: {resource.lessonTitle}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

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
  const [preview, setPreview] = useState<ResourceLibraryItem | null>(null)

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
      <ToastContainer />
      {preview && (
        <ResourcePreviewSlideOver resource={preview} onClose={() => setPreview(null)} />
      )}
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
                <tr
                  key={r.id}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  onClick={() => setPreview(r)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-blue-700 hover:text-blue-900 min-w-0">
                      <Icon name={TYPE_ICONS[r.type] ?? 'attach_file'} size="sm" className="shrink-0 text-gray-400" />
                      <span className="truncate max-w-[220px]">{r.label}</span>
                      {r.url && <Icon name="open_in_new" size="sm" className="shrink-0 text-gray-300" />}
                    </div>
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
