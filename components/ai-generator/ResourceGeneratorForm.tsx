'use client'

import { useState, useEffect, useTransition } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import {
  generateResource,
  getSubjectsForSchool,
  getYearGroupsForSubject,
  getTopicsForSubjectAndYear,
} from '@/app/actions/ai-generator'
import type { GenerateInput, GeneratedResourceData } from '@/app/actions/ai-generator'

const RESOURCE_TYPES = [
  { value: 'worksheet',          label: 'Worksheet'          },
  { value: 'powerpoint_outline', label: 'PowerPoint Outline' },
  { value: 'quiz',               label: 'Quiz'               },
  { value: 'reading_passage',    label: 'Reading Passage'    },
  { value: 'vocabulary_list',    label: 'Vocabulary List'    },
  { value: 'knowledge_organiser', label: 'Knowledge Organiser' },
]

const SEND_OPTIONS = [
  { value: 'dyslexia',           label: 'Dyslexia'            },
  { value: 'adhd',               label: 'ADHD'                },
  { value: 'low_literacy',       label: 'Low Literacy'        },
  { value: 'eal',                label: 'EAL'                 },
  { value: 'visual_impairment',  label: 'Visual Impairment'   },
  { value: 'hearing_impairment', label: 'Hearing Impairment'  },
]

const LABEL = 'block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide'
const SELECT = 'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed'

type Props = {
  schoolId:    string
  lessonId?:   string
  onGenerated: (result: GeneratedResourceData & { content: string }) => void
}

export default function ResourceGeneratorForm({ schoolId, lessonId, onGenerated }: Props) {
  // ── cascade data ──────────────────────────────────────────────────────────
  const [subjects,   setSubjects]   = useState<string[]>([])
  const [yearGroups, setYearGroups] = useState<number[]>([])
  const [topics,     setTopics]     = useState<string[]>([])

  const [loadingSubjects,   setLoadingSubjects]   = useState(true)
  const [loadingYearGroups, setLoadingYearGroups] = useState(false)
  const [loadingTopics,     setLoadingTopics]     = useState(false)

  // ── selections ────────────────────────────────────────────────────────────
  const [subject,      setSubject]      = useState('')
  const [yearGroup,    setYearGroup]    = useState<number | ''>('')
  const [topic,        setTopic]        = useState('')
  const [customTopic,  setCustomTopic]  = useState('')
  const [resourceType, setResourceType] = useState('worksheet')
  const [sendAdaptations, setSendAdaptations] = useState<string[]>([])
  const [notes,        setNotes]        = useState('')
  const [error,        setError]        = useState('')
  const [pending, start] = useTransition()

  const effectiveTopic = topic === '__custom__' ? customTopic : topic

  // ── load subjects on mount ────────────────────────────────────────────────
  useEffect(() => {
    setLoadingSubjects(true)
    getSubjectsForSchool()
      .then(setSubjects)
      .catch(() => {})
      .finally(() => setLoadingSubjects(false))
  }, [])

  // ── load year groups when subject changes ─────────────────────────────────
  useEffect(() => {
    setYearGroups([])
    setYearGroup('')
    setTopics([])
    setTopic('')
    if (!subject) return
    setLoadingYearGroups(true)
    getYearGroupsForSubject(subject)
      .then(setYearGroups)
      .catch(() => {})
      .finally(() => setLoadingYearGroups(false))
  }, [subject])

  // ── load topics when year group changes ───────────────────────────────────
  useEffect(() => {
    setTopics([])
    setTopic('')
    if (!subject || yearGroup === '') return
    setLoadingTopics(true)
    getTopicsForSubjectAndYear(subject, yearGroup as number)
      .then(setTopics)
      .catch(() => {})
      .finally(() => setLoadingTopics(false))
  }, [subject, yearGroup])

  function toggleSend(val: string) {
    setSendAdaptations(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject)              { setError('Select a subject');    return }
    if (yearGroup === '')      { setError('Select a year group'); return }
    if (!effectiveTopic.trim()) { setError('Select a topic');     return }
    setError('')

    const input: GenerateInput = {
      schoolId,
      subject,
      yearGroup:  `Year ${yearGroup}`,
      topic:       effectiveTopic,
      resourceType,
      sendAdaptations,
      additionalNotes: notes,
      lessonId,
    }

    start(async () => {
      try {
        const result = await generateResource(input)
        onGenerated({
          id:            result.id,
          schoolId,
          createdBy:     '',
          title:         result.title,
          subject,
          yearGroup:     `Year ${yearGroup}`,
          resourceType,
          topic:         effectiveTopic,
          content:       result.content,
          sendAdapted:   sendAdaptations.length > 0,
          sendNotes:     sendAdaptations.length > 0 ? sendAdaptations.join(', ') : null,
          modelVersion:  'claude-sonnet-4-6',
          createdAt:     new Date(),
          linkedLessonId: lessonId ?? null,
        })
      } catch (err: any) {
        setError(err?.message ?? 'Failed to generate resource. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Subject ─────────────────────────────────────────────────────── */}
      <div>
        <label className={LABEL}>Subject</label>
        <div className="relative">
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={loadingSubjects}
            className={SELECT}
          >
            <option value="">
              {loadingSubjects ? 'Loading subjects…' : 'Select subject…'}
            </option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {loadingSubjects && (
            <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      {/* ── Year Group ──────────────────────────────────────────────────── */}
      <div>
        <label className={LABEL}>Year Group</label>
        <div className="relative">
          <select
            value={yearGroup}
            onChange={e => setYearGroup(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={!subject || loadingYearGroups}
            className={SELECT}
          >
            <option value="">
              {!subject
                ? 'Select a subject first'
                : loadingYearGroups
                  ? 'Loading year groups…'
                  : 'Select year group…'}
            </option>
            {yearGroups.map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
          {loadingYearGroups && (
            <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      {/* ── Topic ───────────────────────────────────────────────────────── */}
      <div>
        <label className={LABEL}>Topic</label>
        <div className="relative">
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            disabled={yearGroup === '' || loadingTopics}
            className={SELECT}
          >
            <option value="">
              {yearGroup === ''
                ? 'Select a year group first'
                : loadingTopics
                  ? 'Loading topics…'
                  : topics.length === 0
                    ? 'No curriculum topics found — choose Other…'
                    : 'Select topic…'}
            </option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
            {yearGroup !== '' && !loadingTopics && (
              <option value="__custom__">Other (enter manually)…</option>
            )}
          </select>
          {loadingTopics && (
            <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          )}
        </div>
        {topic === '__custom__' && (
          <input
            type="text"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            placeholder="e.g. 'The causes of World War One'"
            className="mt-1.5 w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus
          />
        )}
      </div>

      {/* ── Resource Type ───────────────────────────────────────────────── */}
      <div>
        <label className={LABEL}>Resource Type</label>
        <select
          value={resourceType}
          onChange={e => setResourceType(e.target.value)}
          className={SELECT}
        >
          {RESOURCE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* ── SEND Adaptations ────────────────────────────────────────────── */}
      <div>
        <label className={LABEL}>
          SEND Adaptations <span className="text-gray-300 font-normal normal-case">(optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {SEND_OPTIONS.map(o => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendAdaptations.includes(o.value)}
                onChange={() => toggleSend(o.value)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-[12px] text-gray-700">{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Additional Notes ────────────────────────────────────────────── */}
      <div>
        <label className={LABEL}>
          Additional Notes <span className="text-gray-300 font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. 'AQA specification', 'Focus on source analysis', 'Mixed-ability class'"
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
        />
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !subject || yearGroup === '' || !effectiveTopic.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending
          ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
          : <><Wand2 size={14} /> Generate Resource</>}
      </button>
    </form>
  )
}
