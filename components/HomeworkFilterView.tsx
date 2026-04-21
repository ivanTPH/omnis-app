'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import Tooltip from '@/components/ui/Tooltip'
import SetHomeworkModal from './SetHomeworkModal'
import ExportPdfButton  from '@/components/ExportPdfButton'
import { useTeacherProfile } from '@/lib/teacherProfileContext'

export type HomeworkListItem = {
  id:             string
  title:          string
  status:         string
  dueAt:          string
  classId:        string | null
  class:          { name: string; subject: string; yearGroup: number } | null
  lesson:         { id: string; title: string } | null
  submittedCount: number
  markedCount:    number
  needsMarkCount: number
  totalEnrolled:  number
}

function statusDisplayLabel(s: string) {
  switch (s) {
    case 'upcoming':  return 'Active & Upcoming'
    case 'past':      return 'Past'
    case 'to_mark':   return 'Needs Marking'
    case 'PUBLISHED': return 'Published'
    case 'DRAFT':     return 'Draft'
    case 'CLOSED':    return 'Closed'
    default:          return s
  }
}

export default function HomeworkFilterView({ homework }: { homework: HomeworkListItem[] }) {
  const router  = useRouter()
  const profile = useTeacherProfile()

  const [subject,   setSubject]   = useState('')
  const [year,      setYear]      = useState('')
  const [classId,   setClassId]   = useState('')
  const [status,    setStatus]    = useState('')
  const [search,    setSearch]    = useState('')
  const [showModal, setShowModal] = useState(false)

  // Apply teacher profile defaults once they arrive from AppShell
  const defaultsApplied = useRef(false)
  useEffect(() => {
    if (defaultsApplied.current || !profile.isLoaded) return
    defaultsApplied.current = true
    if (profile.defaultSubject) setSubject(profile.defaultSubject)
    if (profile.defaultYearGroup != null) setYear(String(profile.defaultYearGroup))
  }, [profile.isLoaded, profile.defaultSubject, profile.defaultYearGroup])

  const now = useMemo(() => new Date(), [])

  // ── Derived filter options ───────────────────────────────────────────────────

  const subjects = useMemo(() =>
    ([...new Set(homework.map(h => h.class?.subject).filter(Boolean))] as string[]).sort(),
    [homework],
  )

  const years = useMemo(() =>
    ([...new Set(homework.map(h => h.class?.yearGroup).filter(Boolean))] as number[])
      .sort((a, b) => a - b),
    [homework],
  )

  // Classes narrowed by active subject/year selection
  const classes = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; subject: string; yearGroup: number }>()
    for (const h of homework) {
      if (!h.classId || !h.class) continue
      if (subject && h.class.subject !== subject) continue
      if (year    && h.class.yearGroup !== Number(year)) continue
      if (!seen.has(h.classId)) seen.set(h.classId, { id: h.classId, ...h.class })
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [homework, subject, year])

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = useMemo(() =>
    homework.filter(h => {
      if (subject  && h.class?.subject   !== subject)        return false
      if (year     && h.class?.yearGroup !== Number(year))   return false
      if (classId  && h.classId          !== classId)        return false
      if (search   && !h.title.toLowerCase().includes(search.toLowerCase())) return false
      if (status === 'upcoming') return new Date(h.dueAt) >= now
      if (status === 'past')     return new Date(h.dueAt) <  now
      if (status === 'to_mark')  return h.needsMarkCount > 0
      if (status && !['upcoming','past','to_mark'].includes(status)) return h.status === status
      return true
    }),
    [homework, subject, year, classId, status, search, now],
  )

  // ── KPIs from filtered set ───────────────────────────────────────────────────

  const totalToMark      = filtered.reduce((a, h) => a + h.needsMarkCount,  0)
  const totalSubmitted   = filtered.reduce((a, h) => a + h.submittedCount,  0)
  const totalEnrolled    = filtered.reduce((a, h) => a + h.totalEnrolled,   0)
  const submissionRate   = totalEnrolled > 0
    ? Math.round((totalSubmitted / totalEnrolled) * 100)
    : null

  // Upcoming / past split (for ungrouped view)
  const upcoming = filtered.filter(h => new Date(h.dueAt) >= now)
  const past     = filtered.filter(h => new Date(h.dueAt) <  now)

  const isFiltered = !!(subject || year || classId || status || search)

  // ── Active filter chips ──────────────────────────────────────────────────────

  const chips = [
    subject && { key: 'subject', label: subject,                                       clear: () => { setSubject(''); setClassId('') } },
    year    && { key: 'year',    label: `Year ${year}`,                                clear: () => { setYear('');    setClassId('') } },
    classId && { key: 'class',   label: classes.find(c => c.id === classId)?.name ?? classId, clear: () => setClassId('') },
    status  && { key: 'status',  label: statusDisplayLabel(status),                   clear: () => setStatus('') },
    search  && { key: 'search',  label: `"${search}"`,                                clear: () => setSearch('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  // ── Homework card ────────────────────────────────────────────────────────────

  function HomeworkCard({ hw }: { hw: HomeworkListItem }) {
    const overdue = new Date(hw.dueAt) < now && hw.status === 'PUBLISHED'
    return (
      <div className="relative group/card">
      <Link
        href={`/homework/${hw.id}`}
        className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          hw.status === 'DRAFT'                      ? 'bg-gray-100' :
          hw.needsMarkCount > 0                      ? 'bg-amber-50' :
          hw.submittedCount < hw.totalEnrolled       ? 'bg-blue-50'  :
          'bg-green-50'
        }`}>
          {hw.status === 'DRAFT'                 ? <Icon name="assignment" size="md" className="text-gray-400"   /> :
           hw.needsMarkCount > 0                 ? <Icon name="schedule"     size="md" className="text-amber-500" /> :
           hw.submittedCount < hw.totalEnrolled  ? <Icon name="error"        size="md" className="text-blue-500"  /> :
           <Icon name="check_circle" size="md" className="text-green-500" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-gray-900 truncate">{hw.title}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              hw.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
              hw.status === 'CLOSED'    ? 'bg-gray-200  text-gray-500'  :
              'bg-amber-100 text-amber-700'
            }`}>{hw.status}</span>
            {overdue && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px] text-gray-500">
            {hw.class && (
              <span>{hw.class.subject} · {hw.class.name} · Year {hw.class.yearGroup}</span>
            )}
            <span className="text-gray-300">·</span>
            <span className="text-gray-400">
              Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            {hw.lesson && (
              <span className="text-gray-400 truncate max-w-[180px]">↳ {hw.lesson.title}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[13px] font-semibold text-gray-900">
              {hw.submittedCount}<span className="text-gray-400 font-normal">/{hw.totalEnrolled}</span>
            </p>
            <p className="text-[10px] text-gray-400">submitted</p>
          </div>
          {hw.needsMarkCount > 0 && (
            <div className="text-right">
              <p className="text-[13px] font-semibold text-amber-600">{hw.needsMarkCount}</p>
              <p className="text-[10px] text-gray-400">to mark</p>
            </div>
          )}
          {hw.needsMarkCount === 0 && hw.markedCount > 0 && (
            <div className="text-right">
              <p className="text-[13px] font-semibold text-green-600">{hw.markedCount}</p>
              <p className="text-[10px] text-gray-400">marked</p>
            </div>
          )}
          <Icon name="chevron_right" size="sm" className="text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </Link>
      <div className="absolute top-3 right-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <ExportPdfButton
          href={`/api/export/homework/${hw.id}`}
          filename={`homework-${hw.title.toLowerCase().replace(/\s+/g,'-').slice(0,30)}.pdf`}
          label="Sheet"
        />
      </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Homework</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {homework.length} assignment{homework.length !== 1 ? 's' : ''}
            {isFiltered && filtered.length !== homework.length
              ? ` · ${filtered.length} shown`
              : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shrink-0"
        >
          <Icon name="add" size="sm" />Set Homework
        </button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Subject */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={e => { setSubject(e.target.value); setClassId('') }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Year Group */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Year Group
            </label>
            <select
              value={year}
              onChange={e => { setYear(e.target.value); setClassId('') }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Class
            </label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="upcoming">Active &amp; Upcoming</option>
              <option value="past">Past</option>
              <option value="to_mark">Needs Marking</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full pl-8 pr-8 py-2 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.map(chip => (
              <button
                key={chip.key}
                onClick={chip.clear}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium hover:bg-blue-100 transition-colors"
              >
                {chip.label}
                <Icon name="close" size="sm" />
              </button>
            ))}
            <button
              onClick={() => { setSubject(''); setYear(''); setClassId(''); setStatus(''); setSearch('') }}
              className="px-2 py-1 text-[11px] text-gray-400 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-[24px] font-bold text-gray-900">{filtered.length}</p>
            <Tooltip content="Total assignments matching current filters">
              <p className="text-[11px] text-gray-400 mt-0.5 cursor-default">Assignment{filtered.length !== 1 ? 's' : ''}</p>
            </Tooltip>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-[24px] font-bold ${totalToMark > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {totalToMark}
            </p>
            <Tooltip content="Submissions awaiting teacher marking">
              <p className="text-[11px] text-gray-400 mt-0.5 cursor-default">To Mark</p>
            </Tooltip>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-[24px] font-bold ${
              submissionRate === null ? 'text-gray-400' :
              submissionRate < 60    ? 'text-rose-500'  :
              submissionRate < 80    ? 'text-amber-600' :
              'text-green-600'
            }`}>
              {submissionRate !== null ? `${submissionRate}%` : '—'}
            </p>
            <Tooltip content="Percentage of enrolled students who submitted. Red < 60%, amber < 80%, green ≥ 80%">
              <p className="text-[11px] text-gray-400 mt-0.5 cursor-default">Submission Rate</p>
            </Tooltip>
          </div>
        </div>
      )}

      {/* ── Homework list ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <Icon name="assignment" size="lg" className="mx-auto text-gray-300 mb-3" />
          <p className="text-[14px] font-medium text-gray-500">
            {homework.length === 0 ? 'No homework set yet' : 'No homework matches your filters'}
          </p>
          {homework.length === 0 ? (
            <p className="text-[12px] text-gray-400 mt-1">Create homework from a lesson in your calendar.</p>
          ) : (
            <button
              onClick={() => { setSubject(''); setYear(''); setClassId(''); setStatus(''); setSearch('') }}
              className="mt-3 text-[12px] text-blue-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>

      ) : isFiltered ? (
        /* Flat list when any filter is active */
        <div className="space-y-2">
          {filtered.map(hw => <HomeworkCard key={hw.id} hw={hw} />)}
        </div>

      ) : (
        /* Grouped upcoming / past when no filters */
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Active &amp; Upcoming
              </h2>
              <div className="space-y-2">
                {upcoming.map(hw => <HomeworkCard key={hw.id} hw={hw} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Past</h2>
              <div className="space-y-2">
                {past.map(hw => <HomeworkCard key={hw.id} hw={hw} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Set Homework modal */}
      {showModal && (
        <SetHomeworkModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}
