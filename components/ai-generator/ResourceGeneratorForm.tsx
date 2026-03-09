'use client'

import { useState, useTransition } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { generateResource } from '@/app/actions/ai-generator'
import type { GenerateInput, GeneratedResourceData } from '@/app/actions/ai-generator'

const SUBJECTS = [
  'English', 'Mathematics', 'Science', 'Biology', 'Chemistry', 'Physics',
  'History', 'Geography', 'Religious Studies', 'French', 'Spanish', 'German',
  'Art & Design', 'Music', 'Drama', 'Physical Education', 'Computer Science',
  'Design & Technology', 'Business Studies', 'Economics', 'Psychology', 'Sociology',
]

const YEAR_GROUPS = ['Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13']

const RESOURCE_TYPES = [
  { value: 'worksheet',           label: 'Worksheet'           },
  { value: 'quiz',                label: 'Quiz'                },
  { value: 'lesson_plan',         label: 'Lesson Plan'         },
  { value: 'exit_ticket',         label: 'Exit Ticket'         },
  { value: 'knowledge_organiser', label: 'Knowledge Organiser' },
]

const SEND_OPTIONS = [
  { value: 'dyslexia',     label: 'Dyslexia'       },
  { value: 'adhd',         label: 'ADHD'            },
  { value: 'eal',          label: 'EAL'             },
  { value: 'low_literacy', label: 'Low Literacy'    },
  { value: 'autism',       label: 'Autism'          },
]

type Props = {
  schoolId: string
  lessonId?: string
  onGenerated: (result: GeneratedResourceData & { content: string }) => void
}

export default function ResourceGeneratorForm({ schoolId, lessonId, onGenerated }: Props) {
  const [subject,         setSubject]         = useState('')
  const [customSubject,   setCustomSubject]   = useState('')
  const [yearGroup,       setYearGroup]       = useState('Y10')
  const [topic,           setTopic]           = useState('')
  const [resourceType,    setResourceType]    = useState('worksheet')
  const [sendAdaptations, setSendAdaptations] = useState<string[]>([])
  const [notes,           setNotes]           = useState('')
  const [error,           setError]           = useState('')
  const [pending, start]                      = useTransition()

  const effectiveSubject = subject === '__custom__' ? customSubject : subject

  function toggleSend(val: string) {
    setSendAdaptations(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!effectiveSubject.trim()) { setError('Subject is required'); return }
    if (!topic.trim())            { setError('Topic is required'); return }
    setError('')

    const input: GenerateInput = {
      schoolId,
      subject: effectiveSubject,
      yearGroup,
      topic,
      resourceType,
      sendAdaptations,
      additionalNotes: notes,
      lessonId,
    }

    start(async () => {
      try {
        const result = await generateResource(input)
        onGenerated({
          id: result.id,
          schoolId,
          createdBy: '',
          title: result.title,
          subject: effectiveSubject,
          yearGroup,
          resourceType,
          topic,
          content: result.content,
          sendAdapted: sendAdaptations.length > 0,
          sendNotes: sendAdaptations.length > 0 ? sendAdaptations.join(', ') : null,
          modelVersion: 'claude-sonnet-4-20250514',
          createdAt: new Date(),
          linkedLessonId: lessonId ?? null,
        })
      } catch {
        setError('Failed to generate resource. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Subject */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Subject</label>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Select subject…</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="__custom__">Other…</option>
        </select>
        {subject === '__custom__' && (
          <input
            type="text"
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            placeholder="Enter subject name"
            className="mt-1.5 w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        )}
      </div>

      {/* Year Group + Resource Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Year Group</label>
          <select
            value={yearGroup}
            onChange={e => setYearGroup(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Resource Type</label>
          <select
            value={resourceType}
            onChange={e => setResourceType(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {RESOURCE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Topic */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. 'The causes of World War One' or 'Quadratic equations'"
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* SEND Adaptations */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">SEND Adaptations</label>
        <div className="flex flex-wrap gap-2">
          {SEND_OPTIONS.map(o => {
            const active = sendAdaptations.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleSend(o.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                  active
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Additional notes */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
          Additional Notes <span className="text-gray-300 font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. 'Focus on primary source analysis', 'AQA specification', 'For a mixed-ability class'"
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
        />
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
      >
        {pending
          ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
          : <><Wand2 size={14} /> Generate Resource</>}
      </button>
    </form>
  )
}
