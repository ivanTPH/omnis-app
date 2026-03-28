'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { addExam, deleteExam } from '@/app/actions/revision'

type Exam = {
  id:          string
  subject:     string
  examBoard:   string | null
  paperName:   string | null
  examDate:    Date
  durationMins: number | null
  sessions:    { id: string; status: string }[]
}

const EXAM_BOARDS = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'Other']

function daysUntil(date: Date): number {
  const now  = new Date(); now.setHours(0,0,0,0)
  const exam = new Date(date); exam.setHours(0,0,0,0)
  return Math.round((exam.getTime() - now.getTime()) / 86400000)
}

function DaysChip({ days }: { days: number }) {
  const colour = days < 14 ? 'bg-red-100 text-red-700'
    : days < 28            ? 'bg-amber-100 text-amber-700'
    : 'bg-green-100 text-green-700'
  const label = days < 0 ? 'Past' : days === 0 ? 'Today' : `${days}d`
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${colour}`}>{label}</span>
}

function BoardBadge({ board }: { board: string }) {
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{board}</span>
}

export default function ExamList({
  exams,
  studentId,
  onRefresh,
}: {
  exams:     Exam[]
  studentId: string
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [pending,  start]       = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)

  const [form, setForm] = useState({
    subject: '', examBoard: '', paperName: '', examDate: '', durationMins: '',
  })

  function field(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleAdd() {
    if (!form.subject || !form.examDate) return
    start(async () => {
      await addExam(studentId, {
        subject:      form.subject,
        examBoard:    form.examBoard || undefined,
        paperName:    form.paperName || undefined,
        examDate:     form.examDate,
        durationMins: form.durationMins ? Number(form.durationMins) : undefined,
      })
      setForm({ subject: '', examBoard: '', paperName: '', examDate: '', durationMins: '' })
      setShowForm(false)
      onRefresh()
    })
  }

  function handleDelete(examId: string) {
    setDeleting(examId)
    start(async () => {
      await deleteExam(examId)
      setDeleting(null)
      onRefresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-gray-900">Upcoming Exams</h3>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          {showForm ? <Icon name="expand_less" size="sm" /> : <Icon name="add" size="sm" />}
          Add Exam
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="col-span-2 input-sm"
              placeholder="Subject (e.g. Biology)"
              value={form.subject}
              onChange={e => field('subject', e.target.value)}
            />
            <select
              className="input-sm"
              value={form.examBoard}
              onChange={e => field('examBoard', e.target.value)}
            >
              <option value="">Exam board</option>
              {EXAM_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <input
              className="input-sm"
              type="date"
              value={form.examDate}
              onChange={e => field('examDate', e.target.value)}
            />
          </div>
          <input
            className="input-sm w-full"
            placeholder="Paper name (optional)"
            value={form.paperName}
            onChange={e => field('paperName', e.target.value)}
          />
          <input
            className="input-sm w-full"
            type="number"
            placeholder="Duration in minutes (optional)"
            value={form.durationMins}
            onChange={e => field('durationMins', e.target.value)}
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={pending || !form.subject || !form.examDate}
              className="flex-1 py-1.5 text-[12px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Adding…' : 'Add Exam'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-[12px] text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {exams.length === 0 && !showForm && (
        <p className="text-[12px] text-gray-400 text-center py-6">
          No exams added yet.<br />Add your exams to start planning.
        </p>
      )}

      <div className="space-y-2">
        {exams.map(exam => {
          const days      = daysUntil(exam.examDate)
          const completed = exam.sessions.filter(s => s.status === 'completed').length
          const total     = exam.sessions.length
          return (
            <div key={exam.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-[13px] font-semibold text-gray-900">{exam.subject}</span>
                    {exam.examBoard && <BoardBadge board={exam.examBoard} />}
                    <DaysChip days={days} />
                  </div>
                  {exam.paperName && (
                    <p className="text-[11px] text-gray-500 truncate">{exam.paperName}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Icon name="calendar_today" size="sm" />
                      {new Date(exam.examDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {total > 0 && (
                      <span className="text-[10px] text-gray-400">{completed}/{total} sessions done</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(exam.id)}
                  disabled={deleting === exam.id}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  <Icon name="delete" size="sm" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .input-sm {
          padding: 0.375rem 0.625rem;
          font-size: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          background: white;
          width: 100%;
          outline: none;
        }
        .input-sm:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
        }
      `}</style>
    </div>
  )
}
