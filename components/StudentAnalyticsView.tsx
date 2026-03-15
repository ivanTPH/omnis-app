'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getStudentPerformance, getSubmissionDetail, getClassSummaries } from '@/app/actions/analytics'
import type { AnalyticsFilters, StudentPerformanceResult, StudentData, HomeworkRow, FilterOptions, ClassSummary } from '@/app/actions/analytics'
import {
  ChevronDown, ChevronRight, CheckCircle, XCircle,
  ExternalLink, Users, TrendingUp, BookOpen, Heart, X, BarChart2, BarChart3, Loader2,
} from 'lucide-react'

type SubmissionDetail = NonNullable<Awaited<ReturnType<typeof getSubmissionDetail>>>
type SortCol = 'name' | 'completion' | 'score'
type PerfFilter = 'all' | 'high' | 'developing' | 'needs_support' | 'not_submitting'

const PERF_OPTIONS: { value: PerfFilter; label: string }[] = [
  { value: 'all',            label: 'All performance levels' },
  { value: 'high',           label: 'High performers' },
  { value: 'developing',     label: 'Developing' },
  { value: 'needs_support',  label: 'Needs support' },
  { value: 'not_submitting', label: 'Not submitting' },
]

const YR_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-violet-50 border-violet-200 text-violet-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-rose-50 border-rose-200 text-rose-700',
  'bg-cyan-50 border-cyan-200 text-cyan-700',
]
function yrBadge(y: number) { return YR_COLORS[(y - 7) % YR_COLORS.length] ?? YR_COLORS[0] }

function computeDates(preset: 'this_year' | 'this_month') {
  const now = new Date()
  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) }
  }
  const sep1 = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1)
  return { dateFrom: sep1.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) }
}

function applyPerfFilter(students: StudentData[], perf: PerfFilter): StudentData[] {
  if (perf === 'all') return students
  return students.filter(s => {
    if (perf === 'high')           return (s.avgScore ?? 0) >= 75 || s.completionRate >= 80
    if (perf === 'developing')     return (s.avgScore ?? 0) >= 50 && (s.avgScore ?? 0) < 75
    if (perf === 'needs_support')  return (s.avgScore ?? 0) < 50 && s.avgScore != null
    if (perf === 'not_submitting') return s.completionRate < 25
    return true
  })
}

// UK GCSE grade from percentage score
function scoreToGrade(score: number): number {
  if (score >= 90) return 9
  if (score >= 80) return 8
  if (score >= 70) return 7
  if (score >= 60) return 6
  if (score >= 50) return 5
  if (score >= 40) return 4
  if (score >= 30) return 3
  return 2
}

export default function StudentAnalyticsView({ filterOptions }: { filterOptions: FilterOptions }) {
  const router = useRouter()

  // Server-side filters — all start as "" = "All ..."
  const [preset,     setPreset]     = useState<'this_year' | 'this_month' | 'custom'>('this_year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [subject,    setSubject]    = useState('')
  const [yearGroup,  setYearGroup]  = useState('')
  const [classId,    setClassId]    = useState('')
  const [sendCat,    setSendCat]    = useState('')
  const [studentId,  setStudentId]  = useState('')

  // Client-side filter
  const [perfFilter, setPerfFilter] = useState<PerfFilter>('all')

  // View mode
  const [viewMode, setViewMode] = useState<'classes' | 'students'>('classes')

  // Student data
  const [data,      setData]         = useState<StudentPerformanceResult | null>(null)
  const [isPending, startTransition] = useTransition()

  // Class summaries
  const [classSummaries,  setClassSummaries]  = useState<ClassSummary[] | null>(null)
  const [isClassPending,  startClassTrans]    = useTransition()

  // Run state — data only loads after explicit Run click
  const [hasRun, setHasRun] = useState(false)

  // Table state — default: highest score first
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sortBy,   setSortBy]   = useState<SortCol>('score')
  const [sortAsc,  setSortAsc]  = useState(false)

  // Submission modal
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null)
  const [subLoading, setSubLoading] = useState(false)

  const isLoading = isPending || isClassPending

  // ── helpers ───────────────────────────────────────────────────────────────

  function getDates() {
    return preset === 'custom'
      ? { dateFrom: customFrom || undefined, dateTo: customTo || undefined }
      : computeDates(preset)
  }

  function buildFilters(overrides: Partial<AnalyticsFilters> = {}): AnalyticsFilters {
    return {
      subject:      subject   || undefined,
      yearGroup:    yearGroup ? Number(yearGroup) : undefined,
      classId:      classId   || undefined,
      sendCategory: sendCat   || undefined,
      studentId:    studentId || undefined,
      ...getDates(),
      ...overrides,
    }
  }

  function fetchStudents(overrides: Partial<AnalyticsFilters> = {}) {
    startTransition(async () => {
      const result = await getStudentPerformance(buildFilters(overrides))
      setData(result)
      setExpanded(null)
    })
  }

  function loadClasses(df?: string, dt?: string) {
    startClassTrans(async () => {
      const summaries = await getClassSummaries(df, dt)
      setClassSummaries(summaries)
    })
  }

  // ── Run — the ONLY trigger for queries ────────────────────────────────────
  function handleRun() {
    setHasRun(true)
    const { dateFrom, dateTo } = getDates()
    loadClasses(dateFrom, dateTo)
    fetchStudents()
  }

  // ── Dropdown handlers — pure state updates, NO auto-queries ──────────────
  function changeSubject(val: string) {
    setSubject(val)
    setClassId('')
  }

  function changeYear(val: string) {
    setYearGroup(val)
    setClassId('')
  }

  function changeClass(val: string) {
    setClassId(val)
    if (val) {
      const cls = filterOptions.classes.find(c => c.id === val)
      if (cls) { setSubject(cls.subject); setYearGroup(String(cls.yearGroup)) }
    }
  }

  function clearFilters() {
    setSubject(''); setYearGroup(''); setClassId('')
    setSendCat(''); setStudentId(''); setPerfFilter('all')
  }

  // Click class row → load its students + switch to student tab (direct user action)
  function drillIntoClass(cls: ClassSummary) {
    setClassId(cls.id); setSubject(cls.subject); setYearGroup(String(cls.yearGroup))
    setViewMode('students')
    setHasRun(true)
    const { dateFrom, dateTo } = getDates()
    startTransition(async () => {
      const result = await getStudentPerformance({
        classId: cls.id, subject: cls.subject, yearGroup: cls.yearGroup, dateFrom, dateTo,
      })
      setData(result); setExpanded(null)
    })
  }

  function toggleSort(col: SortCol) {
    if (sortBy === col) setSortAsc(s => !s)
    else { setSortBy(col); setSortAsc(col !== 'score') }
  }

  async function openSubmission(submissionId: string) {
    setSubLoading(true)
    try {
      const detail = await getSubmissionDetail(submissionId)
      if (detail) setSubmission(detail)
    } finally { setSubLoading(false) }
  }

  const hasFilters = subject || yearGroup || classId || sendCat || studentId || perfFilter !== 'all'
  const filteredClasses = filterOptions.classes.filter(c =>
    (!subject   || c.subject   === subject) &&
    (!yearGroup || c.yearGroup === Number(yearGroup))
  )

  const perfFiltered = applyPerfFilter(data?.students ?? [], perfFilter)
  const sorted = [...perfFiltered].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name')       cmp = `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
    if (sortBy === 'completion') cmp = a.completionRate - b.completionRate
    if (sortBy === 'score')      cmp = (a.avgScore ?? -1) - (b.avgScore ?? -1)
    return sortAsc ? cmp : -cmp
  })

  // Class stats for Students tab header bar
  const studentScores = data?.students.filter(s => s.avgScore != null).map(s => s.avgScore!) ?? []
  const classHighest  = studentScores.length > 0 ? Math.max(...studentScores) : null
  const classLowest   = studentScores.length > 0 ? Math.min(...studentScores) : null

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto bg-gray-50">

      {/* ── Header + filters ── */}
      <div className="px-6 pt-6 pb-5 border-b border-gray-200 bg-white shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Student Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">Select filters and click <strong>Run</strong> to view analytics</p>
          </div>
          <div className="flex items-center gap-1.5">
            {(['this_year', 'this_month', 'custom'] as const).map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  preset === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {p === 'this_year' ? 'This Year' : p === 'this_month' ? 'This Month' : 'Custom Range'}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
          </div>
        )}

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Subject</label>
            <select value={subject} onChange={e => changeSubject(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white w-full">
              <option value="">All Subjects</option>
              {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Year Group</label>
            <select value={yearGroup} onChange={e => changeYear(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white w-full">
              <option value="">All Year Groups</option>
              {filterOptions.yearGroups.map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Class</label>
            <select value={classId} onChange={e => changeClass(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white w-full">
              <option value="">All Classes</option>
              {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">SEND Need</label>
            <select value={sendCat} onChange={e => setSendCat(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white w-full">
              <option value="">All SEND</option>
              <option value="__send_only__">Has SEND (any)</option>
              {filterOptions.sendCategories.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Performance</label>
            <select value={perfFilter} onChange={e => setPerfFilter(e.target.value as PerfFilter)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white w-full">
              {PERF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Individual</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white w-full">
              <option value="">All Students</option>
              {filterOptions.students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
            </select>
          </div>
        </div>

        {/* Run button row */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            onClick={handleRun}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isLoading ? (
              <><Loader2 size={14} className="animate-spin" />Running...</>
            ) : (
              <>Run</>
            )}
          </button>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {subject   && <Chip label={subject} onRemove={() => changeSubject('')} />}
              {yearGroup && <Chip label={`Year ${yearGroup}`} onRemove={() => changeYear('')} />}
              {classId   && <Chip label={filterOptions.classes.find(c => c.id === classId)?.name ?? classId} onRemove={() => changeClass('')} />}
              {sendCat   && <Chip label={sendCat === '__send_only__' ? 'Has SEND' : sendCat.replace(/_/g, ' ')} onRemove={() => setSendCat('')} />}
              {studentId && <Chip label={(() => { const s = filterOptions.students.find(s => s.id === studentId); return s ? `${s.lastName}, ${s.firstName}` : '' })()} onRemove={() => setStudentId('')} />}
              {perfFilter !== 'all' && <Chip label={PERF_OPTIONS.find(o => o.value === perfFilter)?.label ?? ''} onRemove={() => setPerfFilter('all')} />}
              <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear all</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto p-6">

        {/* Tab toggle */}
        <div className="flex items-center gap-1 mb-5 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          <button
            onClick={() => setViewMode('classes')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'classes' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={14} />Classes
          </button>
          <button
            onClick={() => setViewMode('students')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'students' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart2 size={14} />Students
          </button>
        </div>

        {/* ── Initial empty state (before first Run) ── */}
        {!hasRun && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart3 size={40} className="text-gray-200 mb-4" />
            <p className="text-gray-600 font-medium mb-1">No data loaded</p>
            <p className="text-sm text-gray-400">Select filters above and click <strong className="text-gray-600">Run</strong> to view analytics</p>
          </div>
        )}

        {/* ── CLASSES TAB ── */}
        {hasRun && viewMode === 'classes' && (
          <>
            {isClassPending && (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!isClassPending && classSummaries !== null && (
              classSummaries.length === 0 ? (
                <div className="text-center py-16 text-sm text-gray-400">No classes found.</div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[1fr_90px_130px_90px_70px_32px] px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    <span>Class</span>
                    <span className="text-right">Students</span>
                    <span className="text-right">Avg Completion</span>
                    <span className="text-right">Avg Score</span>
                    <span className="text-right">SEND</span>
                    <span />
                  </div>
                  {classSummaries.map(cls => (
                    <ClassRow key={cls.id} cls={cls} onDrillDown={() => drillIntoClass(cls)} />
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* ── STUDENTS TAB ── */}
        {hasRun && viewMode === 'students' && (
          <>
            {isPending && (
              <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {data && !isPending && (
              <>
                {/* Class stats bar */}
                {studentScores.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 mb-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="text-gray-500">Class average: <strong className="text-gray-900">{data.avgScore ?? '—'}</strong></span>
                    <span className="text-gray-500">Highest: <strong className="text-green-700">{classHighest}</strong></span>
                    <span className="text-gray-500">Lowest: <strong className="text-rose-600">{classLowest}</strong></span>
                    <span className="text-gray-500">SEND: <strong className="text-amber-700">{data.sendCount}</strong></span>
                  </div>
                )}

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <KpiCard icon={Users}       label="Students"       value={String(data.totalStudents)}                         color="blue"   />
                  <KpiCard icon={CheckCircle} label="Avg Completion" value={`${data.avgCompletion}%`}                           color="green"  />
                  <KpiCard icon={TrendingUp}  label="Avg Score"      value={data.avgScore != null ? `${data.avgScore}` : '—'}   color="purple" />
                  <KpiCard icon={Heart}       label="SEND Students"  value={String(data.sendCount)}                             color="amber"  />
                </div>

                {data.students.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
                    <BookOpen size={28} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No students match the selected filters.</p>
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
                    <p className="text-gray-500 text-sm">No students match the performance filter.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[1fr_130px_110px_110px_80px] px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <SortBtn col="name"       active={sortBy} asc={sortAsc} toggle={toggleSort}>Name</SortBtn>
                      <SortBtn col="completion" active={sortBy} asc={sortAsc} toggle={toggleSort}>Completion</SortBtn>
                      <SortBtn col="score"      active={sortBy} asc={sortAsc} toggle={toggleSort}>
                        <span title="Running average across all homework tasks">Avg Score</span>
                      </SortBtn>
                      <div title="Positive = above class average · Negative = below class average" className="cursor-help">
                        vs Class Avg ↕
                      </div>
                      <div>SEND</div>
                    </div>
                    {sorted.map(student => (
                      <StudentTableRow
                        key={student.id}
                        student={student}
                        expanded={expanded === student.id}
                        onExpand={() => setExpanded(expanded === student.id ? null : student.id)}
                        onOpenSubmission={openSubmission}
                        subLoading={subLoading}
                        onNavigate={() => router.push(`/analytics/students/${student.id}`)}
                        scoreToGrade={scoreToGrade}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* No marked homework yet */}
            {data && !isPending && data.students.length > 0 && studentScores.length === 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-700">
                No marked homework yet for this selection. Scores will appear here once homework has been marked.
              </div>
            )}
          </>
        )}
      </div>

      {submission && <SubmissionModal detail={submission} onClose={() => setSubmission(null)} />}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 ml-0.5"><X size={10} /></button>
    </span>
  )
}

function SortBtn({ col, active, asc, toggle, children }: {
  col: SortCol; active: SortCol; asc: boolean; toggle: (c: SortCol) => void; children: React.ReactNode
}) {
  return (
    <button onClick={() => toggle(col)} className="flex items-center gap-1 hover:text-gray-700 text-left">
      {children}{active === col && <span>{asc ? '↑' : '↓'}</span>}
    </button>
  )
}

function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: 'blue' | 'green' | 'purple' | 'amber'
}) {
  const colors = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', purple: 'bg-purple-50 text-purple-700', amber: 'bg-amber-50 text-amber-700' }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}><Icon size={15} /></div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-[12px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function ClassRow({ cls, onDrillDown }: { cls: ClassSummary; onDrillDown: () => void }) {
  const completionColor = cls.avgCompletion == null ? 'text-gray-400'
    : cls.avgCompletion >= 75 ? 'text-green-600' : cls.avgCompletion >= 50 ? 'text-amber-600' : 'text-rose-600'
  const scoreColor = cls.avgScore == null ? 'text-gray-400'
    : cls.avgScore >= 75 ? 'text-green-600' : cls.avgScore >= 55 ? 'text-amber-600' : 'text-rose-600'
  const barColor = cls.avgCompletion == null ? 'bg-gray-200'
    : cls.avgCompletion >= 75 ? 'bg-green-500' : cls.avgCompletion >= 50 ? 'bg-amber-400' : 'bg-rose-400'

  return (
    <div
      onClick={onDrillDown}
      className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_130px_90px_70px_32px] items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-blue-50/40 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${yrBadge(cls.yearGroup)}`}>
          Y{cls.yearGroup}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{cls.name}</div>
          <div className="text-xs text-gray-400">{cls.subject}</div>
        </div>
      </div>

      <div className="text-right text-sm font-semibold text-gray-800 sm:block hidden">{cls.studentCount}</div>

      <div className="hidden sm:flex flex-col items-end gap-1">
        {cls.avgCompletion != null ? (
          <>
            <div className="w-20 bg-gray-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${cls.avgCompletion}%` }} />
            </div>
            <span className={`text-xs font-semibold ${completionColor}`}>{cls.avgCompletion}%</span>
          </>
        ) : (
          <span className="text-xs text-gray-300">No homework</span>
        )}
      </div>

      <div className={`hidden sm:block text-right text-sm font-semibold ${scoreColor}`}>
        {cls.avgScore != null ? cls.avgScore : '—'}
      </div>

      <div className="hidden sm:block text-right">
        {cls.sendCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
            <Heart size={11} />{cls.sendCount}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      <ChevronRight size={15} className="text-gray-400 shrink-0" />
    </div>
  )
}

function StudentTableRow({ student, expanded, onExpand, onOpenSubmission, subLoading, onNavigate, scoreToGrade }: {
  student: StudentData; expanded: boolean; onExpand: () => void
  onOpenSubmission: (id: string) => Promise<void>; subLoading: boolean; onNavigate: () => void
  scoreToGrade: (score: number) => number
}) {
  const sendLabel: Record<string, string> = { SEN_SUPPORT: 'SEN', EHCP: 'EHCP' }

  // Delta display: student avg - class avg → positive = above, negative = below
  const delta = student.scoreVsClass
  const deltaLabel = delta == null ? null
    : delta > 0 ? `${delta}% above class average`
    : delta < 0 ? `${Math.abs(delta)}% below class average`
    : 'At class average'

  return (
    <>
      <div className="flex sm:grid sm:grid-cols-[1fr_130px_110px_110px_80px] items-center gap-3 sm:gap-0 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 select-none">
        {/* Name + expand */}
        <div onClick={onExpand} className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
          {expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          <span className="text-sm font-medium text-gray-900 truncate">{student.lastName}, {student.firstName}</span>
          {student.hasSend && (
            <span className="hidden sm:inline text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-1 shrink-0">
              {sendLabel[student.sendCategory ?? ''] ?? student.sendCategory}
            </span>
          )}
        </div>

        {/* Completion */}
        <div onClick={onExpand} className="hidden sm:flex items-center gap-2 cursor-pointer">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[48px]">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${student.completionRate}%` }} />
          </div>
          <span className="text-xs text-gray-600 w-8 text-right shrink-0">{student.completionRate}%</span>
        </div>

        {/* Avg score */}
        <div onClick={onExpand} className="hidden sm:block text-sm text-gray-700 cursor-pointer px-1"
          title={student.avgScore != null ? `Running average across all homework tasks (${student.avgScore} ≈ Grade ${scoreToGrade(student.avgScore)})` : undefined}>
          {student.avgScore != null ? (
            <span>{student.avgScore} <span className="text-xs text-gray-400">≈{scoreToGrade(student.avgScore)}</span></span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        {/* vs class avg — POSITIVE = above average (green), NEGATIVE = below average (red) */}
        <div onClick={onExpand} className="hidden sm:block text-sm cursor-pointer px-1" title={deltaLabel ?? undefined}>
          {delta != null ? (
            delta === 0 ? (
              <span className="text-xs text-gray-400 font-medium">≈ avg</span>
            ) : (
              <span className={`font-semibold ${delta > 0 ? 'text-green-600' : 'text-rose-600'}`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )
          ) : <span className="text-gray-400">—</span>}
        </div>

        {/* Navigate */}
        <div className="hidden sm:flex items-center justify-end">
          <button onClick={onNavigate} title="Open student dashboard"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-colors">
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Mobile */}
        <div className="flex sm:hidden items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">{student.completionRate}%</span>
          {student.hasSend && <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">SEN</span>}
          <button onClick={onNavigate} className="p-1 text-gray-400"><ExternalLink size={11} /></button>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-2">
          {student.homeworks.length === 0 ? (
            <p className="text-xs text-gray-500 py-3 text-center">No homework assigned in this period.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {student.homeworks.map(hw => (
                <HomeworkTimelineRow key={hw.homeworkId} hw={hw}
                  onOpen={hw.submissionId ? () => onOpenSubmission(hw.submissionId!) : undefined}
                  loading={subLoading}
                  scoreToGrade={scoreToGrade} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function HomeworkTimelineRow({ hw, onOpen, loading, scoreToGrade }: {
  hw: HomeworkRow; onOpen?: () => void; loading: boolean; scoreToGrade: (score: number) => number
}) {
  const dateStr = new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const grade   = hw.grade ?? (hw.score != null ? String(scoreToGrade(hw.score)) : null)
  return (
    <div onClick={!loading ? onOpen : undefined}
      className={`flex items-center gap-3 py-2.5 px-1 rounded text-xs ${onOpen ? 'cursor-pointer hover:bg-white transition-colors' : 'opacity-60'}`}>
      {hw.submitted ? <CheckCircle size={13} className="text-green-500 shrink-0" /> : <XCircle size={13} className="text-gray-300 shrink-0" />}
      <span className="flex-1 text-gray-700 truncate">{hw.subject} — {hw.title}</span>
      <span className="text-gray-400 shrink-0">{dateStr}</span>
      {hw.submitted && hw.score != null ? (
        <span className="text-gray-700 shrink-0 font-medium w-20 text-right">
          {Math.round(hw.score)}
          {grade && <span className="text-gray-400 font-normal"> (Grade {grade})</span>}
        </span>
      ) : hw.submitted ? (
        <span className="text-gray-400 shrink-0">Submitted</span>
      ) : (
        <span className="text-rose-400 shrink-0">Not submitted</span>
      )}
      {hw.submissionId && <ExternalLink size={11} className="text-gray-300 shrink-0" />}
    </div>
  )
}

function SubmissionModal({ detail, onClose }: { detail: SubmissionDetail; onClose: () => void }) {
  const submittedDate = new Date(detail.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{detail.studentName}</h2>
            <p className="text-sm text-gray-600 mt-0.5">{detail.homework.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">Submitted {submittedDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {(detail.finalScore != null || detail.grade) && (
            <div className="flex items-center gap-3">
              {detail.finalScore != null && (
                <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-center min-w-[60px]">
                  <div className="text-2xl font-bold text-blue-700">{Math.round(detail.finalScore)}</div>
                  <div className="text-[10px] text-blue-500 mt-0.5">This task</div>
                </div>
              )}
              {detail.grade && (
                <div className="bg-purple-50 rounded-xl px-4 py-2.5 text-center min-w-[60px]">
                  <div className="text-2xl font-bold text-purple-700">{detail.grade}</div>
                  <div className="text-[10px] text-purple-500 mt-0.5">Grade</div>
                </div>
              )}
            </div>
          )}
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Student&apos;s Answer</div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
              {detail.content || <span className="text-gray-400 italic">No content recorded</span>}
            </div>
          </div>
          {detail.feedback && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Teacher Feedback</div>
              <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{detail.feedback}</div>
            </div>
          )}
          <a href={detail.markingUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            Give Feedback <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  )
}
