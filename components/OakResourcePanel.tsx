'use client'
import { useState, useEffect, useTransition } from 'react'
import {
  Search, Loader2, Plus, ChevronDown, ChevronUp, Check,
  BookOpen, ExternalLink,
} from 'lucide-react'
import {
  searchOakLessons,
  getOakLesson,
  getOakSubjects,
  addOakLessonToLesson,
} from '@/app/actions/oak'
import type { OakLessonSearchResult } from '@/app/actions/oak'
import SendScoreButton from '@/components/send/SendScoreButton'

// ── Types ──────────────────────────────────────────────────────────────────────

type OakSubject    = { slug: string; title: string; phase: string }
type OakLessonFull = Awaited<ReturnType<typeof getOakLesson>>

// ── Helpers ────────────────────────────────────────────────────────────────────

const KS_LABEL: Record<string, string> = {
  ks1: 'KS1', ks2: 'KS2', ks3: 'KS3', ks4: 'KS4',
}

const EXAM_BOARD_LABELS: Record<string, string> = {
  aqa: 'AQA', edexcel: 'Edexcel', edexcelb: 'Edexcel B',
  ocr: 'OCR', wjec: 'WJEC', eduqas: 'Eduqas', pearson: 'Pearson',
}

// Extract a flat string array from Oak JSON fields (handles multiple shapes)
function extractStrings(json: unknown): string[] {
  if (!Array.isArray(json)) return []
  return json.flatMap(item => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const val =
        obj.keyword        ?? obj.keyLearningPoint ?? obj.teacherTip ??
        obj.misconception  ?? obj.title            ?? obj.text       ?? obj.value
      if (typeof val === 'string') return [val]
    }
    return []
  })
}

// ── Resource indicator badge ───────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${color}`}>
      {label}
    </span>
  )
}

// ── Expanded lesson detail ─────────────────────────────────────────────────────

function LessonDetail({ lesson }: { lesson: OakLessonFull }) {
  if (!lesson) return null

  const keywords    = extractStrings(lesson.lessonKeywords)
  const keyPoints   = extractStrings(lesson.keyLearningPoints)
  const tips        = extractStrings(lesson.teacherTips)
  const misconceptions = extractStrings(lesson.misconceptionsAndCommonMistakes)

  return (
    <div className="mt-3 pl-3 border-l-2 border-blue-100 space-y-3">

      {lesson.pupilLessonOutcome && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Learning outcome</p>
          <p className="text-[12px] text-gray-700 leading-relaxed">{lesson.pupilLessonOutcome}</p>
        </div>
      )}

      {keywords.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Key learning points</p>
          <ul className="space-y-1">
            {keyPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700 leading-snug">
                <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-blue-600">{i + 1}</span>
                </div>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tips.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Teacher tips</p>
          <ul className="space-y-1">
            {tips.map((tip, i) => (
              <li key={i} className="text-[12px] text-gray-600 leading-snug pl-2 border-l border-amber-200">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {misconceptions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Common misconceptions</p>
          <ul className="space-y-1">
            {misconceptions.map((m, i) => (
              <li key={i} className="text-[12px] text-gray-600 leading-snug pl-2 border-l border-red-200">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lesson.slug && (
        <a
          href={`https://www.thenational.academy/teachers/lessons/${lesson.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 hover:underline"
        >
          <ExternalLink size={11} /> View on Oak National Academy
        </a>
      )}
    </div>
  )
}

// ── Result row ─────────────────────────────────────────────────────────────────

function ResultRow({
  result,
  isExpanded,
  expandedDetail,
  loadingDetail,
  added,
  adding,
  onToggle,
  onAdd,
}: {
  result:        OakLessonSearchResult
  isExpanded:    boolean
  expandedDetail: OakLessonFull | null
  loadingDetail: boolean
  added:         boolean
  adding:        boolean
  onToggle:      () => void
  onAdd:         () => void
}) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Row summary */}
      <div
        className="flex items-start gap-2.5 p-2.5 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-gray-800 leading-tight">{result.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{result.unitTitle}</p>
          {result.pupilLessonOutcome && !isExpanded && (
            <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{result.pupilLessonOutcome}</p>
          )}
        </div>

        {/* Metadata badges */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {result.yearGroup && (
            <Badge label={`Y${result.yearGroup}`} color="bg-gray-100 text-gray-600" />
          )}
          {result.keystage && !result.yearGroup && (
            <Badge label={KS_LABEL[result.keystage] ?? result.keystage} color="bg-gray-100 text-gray-600" />
          )}
          {result.examBoard && (
            <Badge label={EXAM_BOARD_LABELS[result.examBoard] ?? result.examBoard} color="bg-violet-100 text-violet-700" />
          )}
          {result.tier && (
            <Badge label={result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} color="bg-teal-100 text-teal-700" />
          )}
          {result.hasQuiz      && <Badge label="Quiz"      color="bg-amber-100 text-amber-700" />}
          {result.hasVideo     && <Badge label="Video"     color="bg-rose-100 text-rose-700"   />}
          {result.hasWorksheet && <Badge label="Worksheet" color="bg-purple-100 text-purple-700" />}
          {result.hasSlides    && <Badge label="Slides"    color="bg-blue-100 text-blue-700"   />}
        </div>

        {/* Expand chevron */}
        <div className="shrink-0 text-gray-300">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
          {loadingDetail && !expandedDetail ? (
            <div className="flex items-center justify-center py-6 text-gray-300">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (
            expandedDetail && <LessonDetail lesson={expandedDetail} />
          )}

          {/* SEND score */}
          <SendScoreButton oakLessonSlug={result.slug} />

          {/* Add button */}
          <div className="flex justify-end mt-3">
            <button
              disabled={adding || added}
              onClick={e => { e.stopPropagation(); onAdd() }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                added
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white'
              }`}
            >
              {added
                ? <><Check size={11} /> Added</>
                : adding
                ? <><Loader2 size={11} className="animate-spin" /> Adding…</>
                : <><Plus size={11} /> Add to lesson</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OakResourcePanel({
  lessonId,
  presetSubjectSlug,
  presetYearGroup,
  onAdded,
}: {
  lessonId:          string
  presetSubjectSlug?: string
  presetYearGroup?:  number
  onAdded:           () => void
}) {
  const [open, setOpen] = useState(false)

  // Filter state — seeded from presets
  const [subjects,    setSubjects]    = useState<OakSubject[]>([])
  const [subjectSlug, setSubjectSlug] = useState(presetSubjectSlug ?? '')
  const [yearGroup,   setYearGroup]   = useState<number | ''>(presetYearGroup ?? '')
  const [examBoard,   setExamBoard]   = useState('')
  const [query,       setQuery]       = useState('')

  // Search results
  const [results,       setResults]       = useState<OakLessonSearchResult[]>([])
  const [hasSearched,   setHasSearched]   = useState(false)
  const [searching,     startSearch]      = useTransition()
  const [yearFallback,  setYearFallback]  = useState(false)

  // Expanded row
  const [expandedSlug,   setExpandedSlug]   = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<OakLessonFull | null>(null)
  const [loadingDetail,  startLoadDetail]   = useTransition()

  // Add tracking
  const [adding,     startAdd]    = useTransition()
  const [addedSlugs, setAddedSlugs] = useState<Set<string>>(new Set())

  /* eslint-disable react-hooks/set-state-in-effect */
  // Load subjects list when panel first opens
  useEffect(() => {
    if (!open || subjects.length > 0) return
    getOakSubjects().then(setSubjects)
  }, [open, subjects.length])

  // Auto-search when opened with presets — fallback to all year groups if no results
  useEffect(() => {
    if (!open || hasSearched) return
    if (!presetSubjectSlug && !presetYearGroup) return
    setHasSearched(true)
    setYearFallback(false)
    startSearch(async () => {
      const res = await searchOakLessons({
        subjectSlug: presetSubjectSlug || undefined,
        yearGroup:   presetYearGroup   || undefined,
        limit:       50,
      })
      if (res.length === 0 && presetYearGroup) {
        const fallback = await searchOakLessons({
          subjectSlug: presetSubjectSlug || undefined,
          limit:       50,
        })
        setResults(fallback)
        setYearFallback(fallback.length > 0)
      } else {
        setResults(res)
      }
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  function runSearch() {
    setHasSearched(true)
    setYearFallback(false)
    startSearch(async () => {
      const res = await searchOakLessons({
        subjectSlug: subjectSlug || undefined,
        yearGroup:   yearGroup   || undefined,
        examBoard:   examBoard   || undefined,
        query:       query       || undefined,
        limit:       50,
      })
      setResults(res)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') runSearch()
  }

  function handleToggleExpand(slug: string) {
    if (expandedSlug === slug) {
      setExpandedSlug(null)
      setExpandedDetail(null)
      return
    }
    setExpandedSlug(slug)
    setExpandedDetail(null)
    startLoadDetail(async () => {
      const detail = await getOakLesson(slug)
      setExpandedDetail(detail)
    })
  }

  function handleAdd(oakSlug: string) {
    startAdd(async () => {
      await addOakLessonToLesson(lessonId, oakSlug)
      setAddedSlugs(prev => new Set([...Array.from(prev), oakSlug]))
      onAdded()
    })
  }

  const YEAR_CHIPS = [7, 8, 9, 10, 11] as const

  return (
    <div className="mt-4">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[12px] font-semibold transition-colors"
      >
        <BookOpen size={13} />
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Oak National Academy
      </button>

      {open && (
        <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
          {/* Filter bar */}
          <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2">

            {/* Row 1: Subject + Exam board */}
            <div className="flex gap-2">
              <select
                value={subjectSlug}
                onChange={e => setSubjectSlug(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All subjects</option>
                {subjects.map(s => (
                  <option key={s.slug} value={s.slug}>{s.title}</option>
                ))}
              </select>

              <select
                value={examBoard}
                onChange={e => setExamBoard(e.target.value)}
                className="w-32 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any board</option>
                {Object.entries(EXAM_BOARD_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Row 2: Year group chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide shrink-0">Year</span>
              <button
                onClick={() => setYearGroup('')}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                  yearGroup === '' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                All
              </button>
              {YEAR_CHIPS.map(y => (
                <button
                  key={y}
                  onClick={() => setYearGroup(yearGroup === y ? '' : y)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                    yearGroup === y ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Row 3: Search input + button */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search lesson titles or outcomes…"
                  className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={runSearch}
                disabled={searching}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold transition-colors"
              >
                {searching
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Search size={12} />}
                Search
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="p-3 space-y-2 max-h-96 overflow-auto">
            {searching ? (
              <div className="flex items-center justify-center py-10 text-gray-300">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : !hasSearched ? (
              <p className="text-[12px] text-gray-400 text-center py-8">
                Set filters above and click Search to browse Oak lessons.
              </p>
            ) : results.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-8">
                No lessons found — try adjusting your filters.
              </p>
            ) : (
              <>
                <p className="text-[10px] text-gray-400 px-0.5">
                  {results.length} lessons
                  {yearFallback && (
                    <span className="ml-1.5 text-amber-600">
                      (no results for Year {presetYearGroup} — showing all year groups)
                    </span>
                  )}
                </p>
                {results.map(r => (
                  <ResultRow
                    key={r.slug}
                    result={r}
                    isExpanded={expandedSlug === r.slug}
                    expandedDetail={expandedSlug === r.slug ? expandedDetail : null}
                    loadingDetail={loadingDetail && expandedSlug === r.slug}
                    added={addedSlugs.has(r.slug)}
                    adding={adding}
                    onToggle={() => handleToggleExpand(r.slug)}
                    onAdd={() => handleAdd(r.slug)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
