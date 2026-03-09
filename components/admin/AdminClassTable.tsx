'use client'

import { useState } from 'react'
import type { ClassRow } from '@/app/actions/admin'

const SUBJECT_COLOURS: Record<string, string> = {
  English:   'bg-blue-50 text-blue-700',
  Maths:     'bg-green-50 text-green-700',
  Science:   'bg-teal-50 text-teal-700',
  History:   'bg-amber-50 text-amber-700',
  Geography: 'bg-emerald-50 text-emerald-700',
  Art:       'bg-pink-50 text-pink-700',
  Drama:     'bg-purple-50 text-purple-700',
  Music:     'bg-rose-50 text-rose-700',
  PE:        'bg-orange-50 text-orange-700',
  RE:        'bg-indigo-50 text-indigo-700',
  French:    'bg-sky-50 text-sky-700',
  Spanish:   'bg-cyan-50 text-cyan-700',
}

function subjectColour(subject: string) {
  return SUBJECT_COLOURS[subject] ?? 'bg-gray-100 text-gray-600'
}

export default function AdminClassTable({ classes }: { classes: ClassRow[] }) {
  const [search, setSearch]         = useState('')
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all')

  const years = [...new Set(classes.map(c => c.yearGroup))].sort((a, b) => a - b)

  const filtered = classes.filter(c => {
    if (yearFilter !== 'all' && c.yearGroup !== yearFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.teacherNames.join(' ').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Filters */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search classes, subjects, teachers…"
          className="w-64 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">All year groups</option>
          {years.map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <span className="text-[12px] text-gray-400">{filtered.length} classes</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Class</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Subject</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Year</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Teacher(s)</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Students</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-semibold text-gray-900">{c.name}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${subjectColour(c.subject)}`}>
                    {c.subject}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-500">Year {c.yearGroup}</td>
                <td className="px-5 py-3.5 text-gray-600">
                  {c.teacherNames.length > 0
                    ? c.teacherNames.join(', ')
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5 font-medium text-gray-900">{c.studentCount}</td>
                <td className="px-5 py-3.5 text-gray-400">{c.department}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-[13px]">
                  No classes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
