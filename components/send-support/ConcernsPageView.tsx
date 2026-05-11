'use client'

import { useState } from 'react'
import type { ConcernRow } from '@/app/actions/send-support'
import ConcernList, { CONCERN_SECTIONS } from './ConcernList'

const STATUSES = ['all', 'open', 'under_review', 'escalated', 'monitoring', 'closed', 'no_action']

type Props = {
  initialConcerns: ConcernRow[]
  staffList?: { id: string; name: string; role: string }[]
}

export default function ConcernsPageView({ initialConcerns, staffList = [] }: Props) {
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')

  const filtered = initialConcerns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (sectionFilter !== 'all') {
      const section = CONCERN_SECTIONS.find(s => s.key === sectionFilter)
      if (section && !(section.categories as readonly string[]).includes(c.category)) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Section</label>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="all">All sections</option>
            {CONCERN_SECTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <span className="text-sm text-gray-500 pb-0.5">{filtered.length} concern{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <ConcernList
        concerns={filtered}
        isSenco={true}
        staffList={staffList}
        groupBySection={sectionFilter === 'all'}
      />
    </div>
  )
}
