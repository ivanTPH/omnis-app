'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Calendar } from 'lucide-react'
import { createCalendarEntry, deleteCalendarEntry } from '@/app/actions/admin'
import type { CalendarEntry } from '@/app/actions/admin'

const TYPE_LABELS: Record<string, string> = {
  TERM_START: 'Term Start',
  TERM_END:   'Term End',
  HOLIDAY:    'Holiday',
  INSET:      'INSET Day',
  EVENT:      'Event',
}

const TYPE_COLOURS: Record<string, string> = {
  TERM_START: 'bg-green-100 text-green-800 border-green-200',
  TERM_END:   'bg-orange-100 text-orange-800 border-orange-200',
  HOLIDAY:    'bg-blue-100 text-blue-800 border-blue-200',
  INSET:      'bg-purple-100 text-purple-800 border-purple-200',
  EVENT:      'bg-gray-100 text-gray-700 border-gray-200',
}

function groupByMonth(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>()
  for (const e of entries) {
    const key = new Date(e.date).toLocaleDateString('en-GB', {
      month: 'long',
      year:  'numeric',
    })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
}

export default function AdminCalendar({
  entries,
  schoolId,
}: {
  entries:  CalendarEntry[]
  schoolId: string
}) {
  const router            = useRouter()
  const [date, setDate]   = useState('')
  const [type, setType]   = useState('HOLIDAY')
  const [label, setLabel] = useState('')
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [error, setError]             = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !label.trim()) { setError('Date and label are required'); return }
    setSaving(true); setError('')
    try {
      await createCalendarEntry(schoolId, date, type, label.trim())
      setDate(''); setLabel(''); setType('HOLIDAY')
      router.refresh()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteCalendarEntry(id)
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  const byMonth = groupByMonth(entries)

  return (
    <div className="space-y-6">

      {/* Add form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-4">Add Entry</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Spring Half Term"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} />{saving ? 'Saving…' : 'Add'}
          </button>
        </form>
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      </div>

      {/* Calendar list */}
      {entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-400">
          <Calendar size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[14px] font-medium">No calendar entries yet</p>
          <p className="text-[12px] mt-1">Add term dates, holidays and INSET days above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...byMonth.entries()].map(([month, monthEntries]) => (
            <div key={month} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-[13px] font-bold text-gray-900">{month}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {monthEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-10 text-center shrink-0">
                      <p className="text-[20px] font-bold text-gray-900 leading-none">
                        {new Date(entry.date).getUTCDate()}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(entry.date).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
                      </p>
                    </div>
                    <div className="flex-1">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLOURS[entry.type] ?? TYPE_COLOURS.EVENT}`}>
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </span>
                      <p className="text-[13px] font-medium text-gray-900 mt-1">{entry.label}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting === entry.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                      aria-label="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
