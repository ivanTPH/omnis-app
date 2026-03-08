'use client'
import { useState, useTransition, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, ChevronLeft, BookOpen, Calendar, Users } from 'lucide-react'
import { createLesson } from '@/app/actions/lessons'
import { LessonType, AudienceType } from '@prisma/client'
import {
  ALL_SUBJECTS,
  getExamBoard,
  getQualification,
  getSubjectData,
} from '@/lib/curriculum'

export type SlideOverClass = {
  id:        string
  name:      string
  subject:   string
  yearGroup: number
}

interface Props {
  open:           boolean
  onClose:        () => void
  defaultDate?:   string
  defaultHour?:   number
  defaultEndHour?: number
  classes:        SlideOverClass[]   // teacher's own classes
  allClasses:     SlideOverClass[]   // all school classes
  onCreated?:     (lessonId: string) => void
}

const LESSON_TYPES: { value: LessonType; label: string }[] = [
  { value: 'NORMAL',       label: 'Normal'      },
  { value: 'COVER',        label: 'Cover'        },
  { value: 'INTERVENTION', label: 'Intervention' },
  { value: 'CLUB',         label: 'Club'         },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function toTimeStr(hour: number) { return `${pad(hour)}:00` }

const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13]

// Step indicators
const STEPS = [
  { n: 1, label: 'Subject & Class', icon: Users },
  { n: 2, label: 'Topic & Lesson',  icon: BookOpen },
  { n: 3, label: 'Schedule',        icon: Calendar },
]

function SelectField({
  label, value, onChange, children, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div>
      {label && <label className="block text-[12px] font-medium text-gray-500 mb-1.5">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
        >
          {children}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

export default function LessonSlideOver({
  open, onClose, defaultDate, defaultHour, defaultEndHour,
  classes, allClasses = [], onCreated,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 state
  const [subject,   setSubjectRaw] = useState('')
  const [yearGroup, setYearGroup]  = useState<number | ''>('')
  const [classId,   setClassId]    = useState('')

  // Step 2 state
  const [lessonTitle, setLessonTitle] = useState('')   // primary field — always required
  const [topicId,    setTopicId]    = useState('')
  const [topicOther, setTopicOther] = useState('')
  const [lessonId,   setLessonId]   = useState('')

  // Step 3 state
  const [date,         setDate]        = useState('')
  const [startTime,    setStartTime]   = useState('')
  const [endTime,      setEndTime]     = useState('')
  const [lessonType,   setLessonType]  = useState<LessonType>('NORMAL')
  const [audienceType, setAudience]    = useState<AudienceType>('CLASS')
  const [isPending,    startTransition]= useTransition()

  // Auto-fill subject from teacher's first class
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      const defaultSubject = classes[0]?.subject ?? ''
      setSubjectRaw(defaultSubject)
      setYearGroup('')
      setClassId('')
      setLessonTitle('')
      setTopicId('')
      setTopicOther('')
      setLessonId('')
      setStep(1)
      setDate(defaultDate ?? new Date().toISOString().split('T')[0])
      setStartTime(defaultHour    != null ? toTimeStr(defaultHour)                              : '09:00')
      setEndTime(defaultEndHour != null ? toTimeStr(defaultEndHour) : defaultHour != null ? toTimeStr(defaultHour + 1) : '10:00')
    }
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // When subject/yearGroup changes, reset class + topic selection
  function setSubject(s: string) {
    setSubjectRaw(s)
    setClassId('')
    setLessonTitle('')
    setTopicId('')
    setTopicOther('')
    setLessonId('')
  }
  function setYear(yg: number | '') {
    setYearGroup(yg)
    setClassId('')
    setLessonTitle('')
    setTopicId('')
    setTopicOther('')
    setLessonId('')
  }
  function setTopic(id: string) {
    setTopicId(id)
    setLessonId('')
  }

  const examBoard    = getExamBoard(subject)
  const qualification= yearGroup !== '' ? getQualification(yearGroup) : ''
  const curriculumData = yearGroup !== '' ? getSubjectData(subject, yearGroup) : null

  const filteredClasses = allClasses.filter(c =>
    c.subject === subject &&
    (yearGroup === '' || c.yearGroup === yearGroup)
  )

  // Topic label (used as the saved `topic` field — optional)
  const topicLabel = topicId === '__other'
    ? topicOther
    : curriculumData?.topics.find(t => t.id === topicId)?.name ?? topicOther

  // Selected topic's lesson list (for quick-fill dropdown)
  const selectedTopic = curriculumData?.topics.find(t => t.id === topicId)

  // Validation per step
  const step1Valid = subject !== '' && yearGroup !== ''
  const step2Valid = lessonTitle.trim() !== ''
  const step3Valid = date !== '' && startTime !== '' && endTime !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!step3Valid) return
    const scheduledAt = new Date(`${date}T${startTime}`).toISOString()
    const endsAt      = new Date(`${date}T${endTime}`).toISOString()

    startTransition(async () => {
      const result = await createLesson({
        classId:     classId || null,
        title:       lessonTitle,
        scheduledAt,
        endsAt,
        lessonType,
        audienceType,
        topic:       topicLabel || undefined,
        examBoard:   examBoard || undefined,
      })
      onClose()
      onCreated?.(result.id)
    })
  }

  const qualColour =
    qualification === 'KS3'     ? 'bg-green-100 text-green-700' :
    qualification === 'GCSE'    ? 'bg-blue-100 text-blue-700' :
    qualification === 'A-Level' ? 'bg-purple-100 text-purple-700' : ''

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">New lesson</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Step {step} of 3 — {STEPS[step - 1].label}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Step pills */}
        <div className="flex gap-1 px-6 py-3 border-b border-gray-100 shrink-0">
          {STEPS.map(s => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                step === s.n ? 'bg-blue-600 text-white' :
                step > s.n  ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>{s.n}</div>
              <span className={`text-[11px] font-medium hidden sm:block ${step === s.n ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
              {s.n < 3 && <ChevronRight size={12} className="text-gray-300 ml-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto px-6 py-5 space-y-5">

            {/* ── Step 1: Subject & Class ─────────────────────────── */}
            {step === 1 && <>
              <SelectField label="Subject" value={subject} onChange={setSubject} required>
                <option value="">Select subject…</option>
                {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </SelectField>

              {/* Exam board + qualification badges */}
              {subject && (
                <div className="flex gap-2">
                  {examBoard && (
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium">
                      {examBoard}
                    </span>
                  )}
                  {qualification && (
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${qualColour}`}>
                      {qualification}
                    </span>
                  )}
                </div>
              )}

              <SelectField label="Year group" value={String(yearGroup)} onChange={v => setYear(v ? Number(v) as number : '')} required>
                <option value="">Select year…</option>
                {YEAR_GROUPS.map(y => <option key={y} value={y}>Year {y}</option>)}
              </SelectField>

              {/* Class picker */}
              {yearGroup !== '' && (
                <SelectField label="Class" value={classId} onChange={setClassId}>
                  <option value="">— No class (out of hours) —</option>
                  {filteredClasses.length > 0
                    ? filteredClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name} · Yr {c.yearGroup}</option>
                      ))
                    : <option value="" disabled>No {subject} Year {yearGroup} classes found</option>
                  }
                </SelectField>
              )}
            </>}

            {/* ── Step 2: Topic & Lesson Name ──────────────────────── */}
            {step === 2 && <>
              {/* Primary required field — always visible */}
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
                  Lesson title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  placeholder={
                    curriculumData?.topics[0]?.lessons[0]?.name
                      ? `e.g. ${curriculumData.topics[0].lessons[0].name}`
                      : subject && yearGroup !== ''
                        ? `e.g. ${subject} — Year ${yearGroup} Lesson`
                        : 'e.g. Lesson title'
                  }
                  autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Optional topic field */}
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
                  Topic <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {curriculumData ? (
                  <SelectField label="" value={topicId} onChange={setTopic}>
                    <option value="">— No topic —</option>
                    {curriculumData.topics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                    <option value="__other">Other (type below)</option>
                  </SelectField>
                ) : (
                  <input
                    type="text"
                    value={topicOther}
                    onChange={e => setTopicOther(e.target.value)}
                    placeholder="e.g. War Poetry"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {topicId === '__other' && (
                  <input
                    type="text"
                    value={topicOther}
                    onChange={e => setTopicOther(e.target.value)}
                    placeholder="Topic name…"
                    className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Optional: quick-fill lesson title from curriculum */}
              {curriculumData && topicId && topicId !== '__other' && selectedTopic && (
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
                    Quick-fill title from curriculum
                  </label>
                  <SelectField label="" value={lessonId} onChange={id => {
                    setLessonId(id)
                    if (id && id !== '__other') {
                      const name = selectedTopic.lessons.find(l => l.id === id)?.name
                      if (name) setLessonTitle(name)
                    }
                  }}>
                    <option value="">— Select to fill title —</option>
                    {selectedTopic.lessons.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </SelectField>
                </div>
              )}
            </>}

            {/* ── Step 3: Schedule ─────────────────────────────────── */}
            {step === 3 && <>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Start time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1.5">End time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Lesson type</label>
                <div className="flex gap-2 flex-wrap">
                  {LESSON_TYPES.map(lt => (
                    <button
                      key={lt.value}
                      type="button"
                      onClick={() => setLessonType(lt.value)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                        lessonType === lt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >{lt.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Audience</label>
                <div className="flex gap-2">
                  {(['CLASS', 'CUSTOM_GROUP'] as AudienceType[]).map(at => (
                    <button
                      key={at}
                      type="button"
                      onClick={() => setAudience(at)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                        audienceType === at
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >{at === 'CLASS' ? 'Whole class' : 'Custom group'}</button>
                  ))}
                </div>
              </div>

              {/* Lesson summary */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <p className="text-[11px] font-medium text-gray-500">Lesson summary</p>
                <p className="text-[13px] font-medium text-gray-900">{lessonTitle}</p>
                <p className="text-[12px] text-gray-500">{subject} · {qualification} · {examBoard}</p>
                {classId && <p className="text-[12px] text-gray-500">{allClasses.find(c => c.id === classId)?.name ?? ''}</p>}
              </div>
            </>}
          </div>

          {/* Footer navigation */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-2 shrink-0">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={step === 1 ? !step1Valid : !step2Valid}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-[13px] font-medium transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending || !step3Valid}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-[13px] font-medium transition-colors"
              >
                {isPending ? 'Creating…' : 'Create lesson'}
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
