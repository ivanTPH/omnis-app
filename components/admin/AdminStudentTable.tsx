'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { StudentRow } from '@/app/actions/admin'
import StudentAvatar from '@/components/StudentAvatar'

const YEAR_OPTIONS = [7, 8, 9, 10, 11]

export default function AdminStudentTable({ students }: { students: StudentRow[] }) {
  const [activeYear, setActiveYear] = useState<number | 'all'>('all')
  const [search, setSearch]         = useState('')

  const filtered = students.filter(s => {
    if (activeYear !== 'all' && s.yearGroup !== activeYear) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
      )
    }
    return true
  })

  function countByYear(yr: number) {
    return students.filter(s => s.yearGroup === yr).length
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Year tabs + search */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveYear('all')}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              activeYear === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({students.length})
          </button>
          {YEAR_OPTIONS.map(yr => (
            <button
              key={yr}
              onClick={() => setActiveYear(yr)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                activeYear === yr
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Y{yr} ({countByYear(yr)})
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or class…"
          className="w-48 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Name</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Year</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Class</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">SEND</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Email</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">
                  <div className="flex items-center gap-2.5">
                    <StudentAvatar
                      firstName={s.firstName}
                      lastName={s.lastName}
                      avatarUrl={s.avatarUrl}
                      userId={s.id}
                      size="xs"
                    />
                    {s.firstName} {s.lastName}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-500">
                  {s.yearGroup ? `Year ${s.yearGroup}` : '—'}
                </td>
                <td className="px-5 py-3.5 text-gray-500">{s.className}</td>
                <td className="px-5 py-3.5">
                  {s.hasSend && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                      SEND
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-[12px]">{s.email}</td>
                <td className="px-5 py-3.5">
                  <Link
                    href="/messages"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
                    title="Message parent"
                  >
                    <Icon name="chat" size="sm" /> Message parent
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-[13px]">
                  No students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
