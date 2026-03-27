'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookMarked, ChevronRight, Loader2, AlertCircle,
  CheckSquare, Square, GraduationCap, BookOpen,
} from 'lucide-react'
import {
  getYearTopics,
  createYearRevisionProgram,
  type getTeacherSubjectsYearGroups,
} from '@/app/actions/revision-program'

type SubjectYG = Awaited<ReturnType<typeof getTeacherSubjectsYearGroups>>[number]

type Step = 'configure' | 'topics' | 'generating'

export default function YearRevisionCreator({ subjectsYearGroups }: { subjectsYearGroups: SubjectYG[] }) {
  const router = useRouter()

  const [step, setStep]       = useState<Step>('configure')
  const [error, setError]     = useState<string | null>(null)

  // Step 1 state
  const [subject,   setSubject]   = useState(subjectsYearGroups[0]?.subject ?? '')
  const [yearGroup, setYearGroup] = useState(subjectsYearGroups[0]?.yearGroup ?? 0)
  const [mode,      setMode]      = useState<'study_guide' | 'formal_assignment'>('study_guide')
  const [deadline,  setDeadline]  = useState('')
  const [isLoading, startLoad]    = useTransition()

  // Step 2 state
  const [allTopics,   setAllTopics]   = useState<string[]>([])
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [studentCount, setStudentCount] = useState(0)
  const [classIds,    setClassIds]    = useState<string[]>([])
  const [title,       setTitle]       = useState('')

  // Step 3 state
  const [_isGenerating, startGenerate] = useTransition()

  // Unique year groups for selected subject
  const yearGroups = subjectsYearGroups
    .filter(s => s.subject === subject)
    .map(s => s.yearGroup)
    .sort()

  const uniqueSubjects = [...new Set(subjectsYearGroups.map(s => s.subject))].sort()

  function handleSubjectChange(s: string) {
    setSubject(s)
    const ygs = subjectsYearGroups.filter(x => x.subject === s).map(x => x.yearGroup).sort()
    setYearGroup(ygs[0] ?? 0)
  }

  function handleLoadTopics() {
    if (!subject || !yearGroup) return
    setError(null)
    startLoad(async () => {
      try {
        const result = await getYearTopics(subject, yearGroup)
        setAllTopics(result.topics)
        setSelected(new Set(result.topics))
        setStudentCount(result.studentCount)
        setClassIds(result.classIds)
        setTitle(`Year ${yearGroup} ${subject} — Year Revision`)
        if (result.topics.length === 0) {
          setError('No lesson topics found for this subject and year group. Make sure lessons have been created.')
          return
        }
        setStep('topics')
      } catch {
        setError('Could not load topics. Please try again.')
      }
    })
  }

  function toggleTopic(t: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  function handleGenerate() {
    if (selected.size === 0) { setError('Select at least one topic.'); return }
    setError(null)
    setStep('generating')
    startGenerate(async () => {
      try {
        const result = await createYearRevisionProgram({
          subject,
          yearGroup,
          classIds,
          selectedTopics: [...selected],
          title,
          mode,
          deadline: deadline ? new Date(deadline) : undefined,
        })
        router.push(`/revision-program/${result.programId}`)
      } catch (err: any) {
        setError(err?.message ?? 'Generation failed. Please try again.')
        setStep('topics')
      }
    })
  }

  // ── Step: Generating ──────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
        <p className="text-base font-semibold text-gray-900">Generating Year Revision…</p>
        <p className="text-sm text-gray-500 max-w-sm">
          Creating personalised revision guides for {studentCount} student{studentCount !== 1 ? 's' : ''} — this may take a minute or two.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <GraduationCap size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Year Revision</h1>
          <p className="text-sm text-gray-500">Generate personalised year-wide revision for a whole year group</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className={step === 'configure' ? 'font-semibold text-blue-600' : 'text-green-600'}>
          1 Configure
        </span>
        <ChevronRight size={12} />
        <span className={step === 'topics' ? 'font-semibold text-blue-600' : 'text-gray-400'}>
          2 Select Topics
        </span>
        <ChevronRight size={12} />
        <span className="text-gray-400">3 Generate</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step 1: Configure ── */}
      {step === 'configure' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject</label>
              <select
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {uniqueSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Year Group</label>
              <select
                value={yearGroup}
                onChange={e => setYearGroup(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {yearGroups.map(yg => (
                  <option key={yg} value={yg}>Year {yg}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'study_guide',       label: 'Study Guide',        desc: 'Students self-study at their own pace' },
                { value: 'formal_assignment',  label: 'Formal Assignment',  desc: 'With deadline, teacher marks responses' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={`border rounded-xl px-4 py-3 text-left transition-colors ${
                    mode === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-medium ${mode === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {mode === 'formal_assignment' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            onClick={handleLoadTopics}
            disabled={isLoading || !subject || !yearGroup}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />}
            {isLoading ? 'Loading topics…' : 'Load Topics →'}
          </button>
        </div>
      )}

      {/* ── Step 2: Select Topics ── */}
      {step === 'topics' && (
        <div className="space-y-4">

          {/* Summary strip */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-indigo-800">{subject} · Year {yearGroup}</span>
            <span className="text-indigo-600">{allTopics.length} topics found</span>
            <span className="text-indigo-600">{studentCount} student{studentCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Program Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Topic checklist */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-600">
                Topics — {selected.size} of {allTopics.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set(allTopics))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {allTopics.map(topic => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  {selected.has(topic)
                    ? <CheckSquare size={15} className="text-blue-600 shrink-0" />
                    : <Square      size={15} className="text-gray-300 shrink-0" />
                  }
                  <span className="text-sm text-gray-800">{topic}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
            <strong>Personalisation:</strong> Each student&apos;s guide will include all selected topics plus a
            highlighted <em>Focus Areas</em> section for topics where their scores were below the class average
            or predicted grade.
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('configure')}
              className="flex-1 border border-gray-300 text-gray-600 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={selected.size === 0 || !title.trim()}
              className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              <BookMarked size={15} />
              Generate for {studentCount} student{studentCount !== 1 ? 's' : ''} →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
