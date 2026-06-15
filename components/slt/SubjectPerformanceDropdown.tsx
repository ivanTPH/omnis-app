'use client'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function SubjectPerformanceDropdown({ subjects }: { subjects: string[] }) {
  const [subject, setSubject] = useState(subjects[0] ?? '')

  if (subjects.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      <select
        value={subject}
        onChange={e => setSubject(e.target.value)}
        className="text-[11px] font-semibold px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {subjects.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <a
        href={`/api/export/subject-performance?subject=${encodeURIComponent(subject)}`}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
      >
        <Icon name="download" size="sm" />
        Subject CSV
      </a>
    </div>
  )
}
