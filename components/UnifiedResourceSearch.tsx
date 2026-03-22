'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import { Search, Plus, Upload, Link2, Loader2, BookOpen, Library, ExternalLink, X, CheckCircle2, Sparkles } from 'lucide-react'
import { searchOakLessons, addOakLessonToLesson } from '@/app/actions/oak'
import { getSchoolResourceLibrary, addLibraryResource, addUrlResource, addUploadedResource, updateLessonObjectives } from '@/app/actions/lessons'
import { extractLearningFromLabel } from '@/app/actions/homework'
import ResourcePreviewModal from '@/components/ResourcePreviewModal'

type OakResult = Awaited<ReturnType<typeof searchOakLessons>>[0]
type SchoolResult = Awaited<ReturnType<typeof getSchoolResourceLibrary>>[0]

type CombinedResult =
  | { kind: 'oak';    data: OakResult }
  | { kind: 'school'; data: SchoolResult }

const TYPE_LABELS: Record<string, string> = {
  PLAN: 'Plan', SLIDES: 'Slides', WORKSHEET: 'Worksheet',
  VIDEO: 'Video', LINK: 'Link', OTHER: 'Other',
}
const TYPE_COLORS: Record<string, string> = {
  PLAN: 'bg-green-100 text-green-700', SLIDES: 'bg-blue-100 text-blue-700',
  WORKSHEET: 'bg-purple-100 text-purple-700', VIDEO: 'bg-rose-100 text-rose-700',
  LINK: 'bg-amber-100 text-amber-700', OTHER: 'bg-gray-100 text-gray-600',
}

function sendScoreColor(s: number) {
  if (s >= 70) return 'bg-green-100 text-green-700'
  if (s >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

// ── Quick upload/link strip ────────────────────────────────────────────────────

type ExtractedObjectives = { objectives: string[]; topics: string[] } | null

function QuickUpload({
  lessonId, subject, yearGroup, onAdded,
}: {
  lessonId:  string
  subject?:  string
  yearGroup?: number
  onAdded:   () => void
}) {
  const [mode, setMode]       = useState<'upload' | 'link' | null>(null)
  const fileRef               = useRef<HTMLInputElement>(null)
  const [file, setFile]       = useState<File | null>(null)
  const [label, setLabel]     = useState('')
  const [url, setUrl]         = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [pending, startT]     = useTransition()
  // Objective extraction state
  const [extracting, setExtracting]           = useState(false)
  const [extracted,  setExtracted]            = useState<ExtractedObjectives>(null)
  const [editObjectives, setEditObjectives]   = useState<string[]>([])
  const [objectivesApplied, setObjApplied]    = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f && !label) setLabel(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    setExtracted(null)
    setObjApplied(false)
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !label) return
    startT(async () => {
      await addUploadedResource(lessonId, { label, type: 'SLIDES', fileName: file.name })
      onAdded()
      // Extract learning objectives after upload
      setExtracting(true)
      try {
        const result = await extractLearningFromLabel({ label, subject, yearGroup })
        setExtracted(result)
        setEditObjectives(result.objectives)
      } catch {
        // silently ignore — upload still succeeded
      } finally {
        setExtracting(false)
      }
    })
  }

  function handleAcceptObjectives() {
    if (!editObjectives.length) return
    startT(async () => {
      await updateLessonObjectives(lessonId, editObjectives)
      setObjApplied(true)
    })
  }

  function handleLink(e: React.FormEvent) {
    e.preventDefault()
    if (!url || !linkLabel) return
    startT(async () => {
      await addUrlResource(lessonId, { label: linkLabel, type: 'LINK', url })
      setUrl(''); setLinkLabel(''); setMode(null)
      onAdded()
    })
  }

  // After upload — show extraction result
  if (mode === 'upload' && (extracting || extracted)) return (
    <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/40">
      {extracting ? (
        <div className="flex items-center gap-2 text-[12px] text-blue-700">
          <Loader2 size={13} className="animate-spin shrink-0" />
          <span><Sparkles size={12} className="inline mr-1" />Extracting learning objectives from your file…</span>
        </div>
      ) : extracted && !objectivesApplied ? (
        <>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5" />
            <p className="text-[12px] font-semibold text-gray-800">File uploaded — learning objectives extracted:</p>
          </div>
          <ul className="space-y-1.5 pl-5">
            {editObjectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[11px] text-gray-500 shrink-0 mt-0.5">•</span>
                <input
                  value={obj}
                  onChange={e => setEditObjectives(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                  className="flex-1 text-[12px] text-gray-800 bg-transparent border-b border-gray-200 focus:outline-none focus:border-blue-400 py-0.5"
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptObjectives}
              disabled={pending}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : null}
              Use these ✓
            </button>
            <button
              onClick={() => { setExtracted(null); setFile(null); setLabel(''); setMode(null); if (fileRef.current) fileRef.current.value = '' }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Add objectives manually
            </button>
          </div>
        </>
      ) : objectivesApplied ? (
        <div className="flex items-center gap-2 text-[12px] text-green-700">
          <CheckCircle2 size={13} className="shrink-0" />
          Objectives added to lesson!
          <button onClick={() => { setExtracted(null); setFile(null); setLabel(''); setMode(null); if (fileRef.current) fileRef.current.value = '' }}
            className="ml-auto text-gray-400 hover:text-gray-600"><X size={12} /></button>
        </div>
      ) : null}
    </div>
  )

  if (mode === 'upload') return (
    <form onSubmit={handleUpload} className="border border-dashed border-blue-300 rounded-xl p-4 space-y-3 bg-blue-50/40">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-blue-700">Upload a file</p>
        <button type="button" onClick={() => setMode(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg p-3 cursor-pointer bg-white hover:border-blue-400 transition-colors">
        <Upload size={16} className="text-gray-400 shrink-0" />
        <span className="text-[12px] text-gray-600 truncate">{file ? file.name : 'Click to choose file (PDF, PPTX, DOCX)'}</span>
        <input ref={fileRef} type="file" accept=".pdf,.pptx,.ppt,.docx,.doc" onChange={handleFileChange} className="hidden" />
      </label>
      {file && (
        <input value={label} onChange={e => setLabel(e.target.value)} required
          placeholder="Resource label"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      )}
      <button type="submit" disabled={pending || !file || !label}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {pending ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )

  if (mode === 'link') return (
    <form onSubmit={handleLink} className="border border-dashed border-blue-300 rounded-xl p-4 space-y-3 bg-blue-50/40">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-blue-700">Add a link</p>
        <button type="button" onClick={() => setMode(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      <input required value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Label (e.g. BBC Bitesize — Macbeth)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      <button type="submit" disabled={pending || !url || !linkLabel}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
        {pending ? 'Adding…' : 'Add link'}
      </button>
    </form>
  )

  return (
    <div className="flex gap-2">
      <button onClick={() => setMode('upload')}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
        <Upload size={12} /> Upload file
      </button>
      <button onClick={() => setMode('link')}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
        <Link2 size={12} /> Add link
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
  'been', 'have', 'has', 'had', 'its', 'about', 'into', 'their', 'than',
  'then', 'over', 'under', 'battle', 'study', 'lesson', 'unit', 'topic',
  'introduction', 'analysis', 'overview', 'review', 'exam', 'test', 'quiz',
])

/** Extract the most useful search keywords from a lesson title, stripping stop words */
function titleToKeywords(title: string | undefined): string {
  if (!title) return ''
  return title
    .replace(/[—\-–:]/g, ' ')
    .split(' ')
    .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 4)
    .join(' ')
}

export default function UnifiedResourceSearch({
  lessonId,
  subjectSlug,
  yearGroup,
  lessonTitle,
  onAdded,
  onGenerateHomework,
}: {
  lessonId:             string
  subjectSlug?:         string
  yearGroup?:           number
  lessonTitle?:         string
  onAdded:              () => void
  onGenerateHomework?:  () => void
}) {
  const [query,            setQuery]            = useState('')
  const [typeFilter,       setTypeFilter]       = useState<'all' | 'worksheet' | 'slides' | 'video' | 'quiz'>('all')
  const [results,          setResults]          = useState<CombinedResult[]>([])
  const [loading,          setLoading]          = useState(false)
  const [broadened,        setBroadened]        = useState(false)
  const [addingId,         setAddingId]         = useState<string | null>(null)
  const [addedIds,         setAddedIds]         = useState<Set<string>>(new Set())
  const [previewSlug,      setPreviewSlug]      = useState<string | null>(null)
  const [showHwBanner,     setShowHwBanner]     = useState(false)
  const [, startAdd]                            = useTransition()
  const debounceRef                             = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load: search by lesson title keywords first, then fall back to subject browse
  useEffect(() => {
    if (!subjectSlug) return
    runSearch(titleToKeywords(lessonTitle))
  }, [subjectSlug, yearGroup, lessonTitle]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runSearch(q: string) {
    setLoading(true)
    setBroadened(false)
    try {
      // First pass: exact subject + exact year group
      let [oakResults, schoolResults] = await Promise.all([
        searchOakLessons({ subjectSlug, yearGroup, query: q || undefined, limit: 20 }),
        getSchoolResourceLibrary(lessonId),
      ])

      // Second pass: if fewer than 3 Oak results, broaden to subject only
      if (oakResults.length < 3 && subjectSlug) {
        const broader = await searchOakLessons({ subjectSlug, query: q || undefined, limit: 20 })
        if (broader.length > oakResults.length) {
          oakResults = broader
          setBroadened(true)
        }
      }

      const combined: CombinedResult[] = [
        ...oakResults.map(d => ({ kind: 'oak' as const, data: d })),
        ...schoolResults
          .filter(r => !q || r.label.toLowerCase().includes(q.toLowerCase()))
          .map(d => ({ kind: 'school' as const, data: d })),
      ]
      setResults(combined)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 400)
  }

  function addOak(slug: string) {
    setAddingId(slug)
    startAdd(async () => {
      await addOakLessonToLesson(lessonId, slug)
      setAddedIds(prev => new Set([...prev, slug]))
      setAddingId(null)
      onAdded()
      if (onGenerateHomework) setShowHwBanner(true)
    })
  }

  function addSchool(resourceId: string) {
    setAddingId(resourceId)
    startAdd(async () => {
      await addLibraryResource(lessonId, resourceId)
      setAddedIds(prev => new Set([...prev, resourceId]))
      setAddingId(null)
      onAdded()
      if (onGenerateHomework) setShowHwBanner(true)
    })
  }

  // Filter results by type
  const filtered = results.filter(r => {
    if (typeFilter === 'all') return true
    if (r.kind === 'oak') {
      if (typeFilter === 'worksheet') return r.data.hasWorksheet
      if (typeFilter === 'slides')    return r.data.hasSlides
      if (typeFilter === 'video')     return r.data.hasVideo
      if (typeFilter === 'quiz')      return r.data.hasQuiz
    }
    if (r.kind === 'school') {
      if (typeFilter === 'worksheet') return r.data.type === 'WORKSHEET'
      if (typeFilter === 'slides')    return r.data.type === 'SLIDES'
      if (typeFilter === 'video')     return r.data.type === 'VIDEO'
    }
    return true
  })

  const TYPE_FILTERS = [
    { key: 'all',       label: 'All'        },
    { key: 'worksheet', label: 'Worksheets' },
    { key: 'slides',    label: 'Slides'     },
    { key: 'video',     label: 'Videos'     },
    { key: 'quiz',      label: 'Quizzes'    },
  ] as const

  return (
    <>
    {previewSlug && (
      <ResourcePreviewModal
        slug={previewSlug}
        lessonId={lessonId}
        onClose={() => setPreviewSlug(null)}
        onAdded={() => { setAddedIds(prev => new Set([...prev, previewSlug])); onAdded() }}
      />
    )}
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Search Oak Academy &amp; school library…"
          className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
        {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {/* Broadened year notice */}
      {broadened && yearGroup && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          No exact Year {yearGroup} matches — showing resources from related year groups
        </p>
      )}

      {/* Homework suggestion banner */}
      {showHwBanner && onGenerateHomework && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={13} className="text-blue-500 shrink-0" />
            <p className="text-[12px] text-blue-800 font-medium truncate">Resource added! Generate homework based on this?</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowHwBanner(false); onGenerateHomework() }}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
            >
              Generate Homework →
            </button>
            <button onClick={() => setShowHwBanner(false)} className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Type filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              typeFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {filtered.length === 0 && !loading && (
          <p className="text-[12px] text-gray-400 text-center py-6">
            {query ? 'No results — try a different search term' : 'No resources found for this subject/year'}
          </p>
        )}

        {filtered.map((item, i) => {
          if (item.kind === 'oak') {
            const r = item.data
            const id = r.slug
            const alreadyAdded = addedIds.has(id)
            return (
              <div key={`oak-${r.slug}`} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-colors">
                <div className="shrink-0 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                    <BookOpen size={9} />Oak
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900 leading-tight truncate">{r.title}</p>
                  {r.pupilLessonOutcome && (
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{r.pupilLessonOutcome}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {r.yearGroup && <span className="text-[10px] text-gray-400">Yr {r.yearGroup}</span>}
                    {r.hasWorksheet && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">Worksheet</span>}
                    {r.hasSlides    && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Slides</span>}
                    {r.hasVideo     && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">Video</span>}
                    {r.hasQuiz      && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Quiz</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => setPreviewSlug(r.slug)}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    disabled={alreadyAdded || addingId === id}
                    onClick={() => addOak(id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      alreadyAdded
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40'
                    }`}
                  >
                    {addingId === id ? <Loader2 size={10} className="animate-spin" /> : alreadyAdded ? '✓ Added' : <><Plus size={10} /> Add</>}
                  </button>
                </div>
              </div>
            )
          }

          // School library resource
          const r = item.data
          const id = r.id
          const alreadyAdded = addedIds.has(id)
          return (
            <div key={`school-${r.id}`} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-colors">
              <div className="shrink-0 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  <Library size={9} />School
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-900 leading-tight truncate">{r.label}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  {r.review && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sendScoreColor(r.review.sendScore)}`}>
                      SEND {r.review.sendScore}/10
                    </span>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-gray-500">
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <button
                  disabled={alreadyAdded || addingId === id}
                  onClick={() => addSchool(id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    alreadyAdded
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40'
                  }`}
                >
                  {addingId === id ? <Loader2 size={10} className="animate-spin" /> : alreadyAdded ? '✓ Added' : <><Plus size={10} /> Add</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Upload / link strip */}
      <div className="pt-1 border-t border-gray-100">
        <QuickUpload lessonId={lessonId} subject={subjectSlug} yearGroup={yearGroup} onAdded={onAdded} />
      </div>
    </div>
    </>
  )
}
