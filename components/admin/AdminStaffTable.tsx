'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { StaffMember } from '@/app/actions/admin'

const ROLE_LABEL: Record<string, string> = {
  TEACHER:       'Teacher',
  HEAD_OF_DEPT:  'Head of Dept',
  HEAD_OF_YEAR:  'Head of Year',
  SENCO:         'SENCo',
  SCHOOL_ADMIN:  'Admin',
  SLT:           'SLT',
  COVER_MANAGER: 'Cover Manager',
}

const ROLE_COLOUR: Record<string, string> = {
  TEACHER:       'bg-blue-50 text-blue-700',
  HEAD_OF_DEPT:  'bg-indigo-50 text-indigo-700',
  HEAD_OF_YEAR:  'bg-violet-50 text-violet-700',
  SENCO:         'bg-purple-50 text-purple-700',
  SCHOOL_ADMIN:  'bg-green-50 text-green-700',
  SLT:           'bg-teal-50 text-teal-700',
  COVER_MANAGER: 'bg-orange-50 text-orange-700',
}

type SortKey = 'name' | 'role' | 'department' | 'classCount'

function sortStaff(staff: StaffMember[], key: SortKey, asc: boolean): StaffMember[] {
  return [...staff].sort((a, b) => {
    const dir = asc ? 1 : -1
    switch (key) {
      case 'name':
        return dir * `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
      case 'role':
        return dir * a.role.localeCompare(b.role)
      case 'department':
        return dir * (a.department ?? '').localeCompare(b.department ?? '')
      case 'classCount':
        return dir * (a.classCount - b.classCount)
    }
  })
}

export default function AdminStaffTable({ staff }: { staff: StaffMember[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filter, setFilter]   = useState('')

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(a => !a)
    else { setSortKey(k); setSortAsc(true) }
  }

  const filtered = sortStaff(
    staff.filter(s => {
      if (!filter) return true
      const q = filter.toLowerCase()
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.department ?? '').toLowerCase().includes(q)
      )
    }),
    sortKey,
    sortAsc,
  )

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Icon name="expand_more" size="sm" className="text-gray-300" />
    return sortAsc
      ? <Icon name="expand_less" size="sm" className="text-blue-600" />
      : <Icon name="expand_more" size="sm" className="text-blue-600" />
  }

  const COLS: { k: SortKey; label: string }[] = [
    { k: 'name',       label: 'Name'       },
    { k: 'role',       label: 'Role'       },
    { k: 'department', label: 'Department' },
    { k: 'classCount', label: 'Classes'    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search by name, email or department…"
          className="w-full sm:w-80 px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLS.map(col => (
                <th
                  key={col.k}
                  onClick={() => toggleSort(col.k)}
                  className="px-5 py-3 text-left font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-900 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {col.label}<SortIcon k={col.k} />
                  </span>
                </th>
              ))}
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Email</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-blue-700 font-bold text-[10px]">
                        {s.firstName[0]}{s.lastName[0]}
                      </span>
                    </div>
                    {s.firstName} {s.lastName}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ROLE_COLOUR[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-500">{s.department ?? '—'}</td>
                <td className="px-5 py-3.5 font-medium text-gray-900">{s.classCount}</td>
                <td className="px-5 py-3.5 text-gray-400 text-[12px]">{s.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    s.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-[13px]">
                  No staff found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
