'use client'

import { useState } from 'react'
import type { ConcernRow } from '@/app/actions/send-support'
import ConcernList, { CONCERN_SECTIONS } from './ConcernList'
import Icon from '@/components/ui/Icon'

const STATUSES = ['all', 'open', 'under_review', 'escalated', 'monitoring', 'closed', 'no_action']

type Props = {
  initialConcerns: ConcernRow[]
  staffList?:      { id: string; name: string; role: string }[]
  followUpDue?:    ConcernRow[]
}

export default function ConcernsPageView({ initialConcerns, staffList = [], followUpDue = [] }: Props) {
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
      {followUpDue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="event" size="sm" className="text-amber-600 shrink-0" />
            <p className="text-[13px] font-bold text-amber-900">Follow-up Reviews Due</p>
            <span className="ml-auto text-[11px] font-medium text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
              {followUpDue.length} concern{followUpDue.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-amber-700 mb-2">The following concerns are due for follow-up review within the next 3 days or are overdue:</p>
          <div className="space-y-1.5">
            {followUpDue.map(c => {
              const isOverdue = c.nextReviewDate ? new Date(c.nextReviewDate) < new Date() : false
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-[12px] font-medium text-amber-900">{c.studentName}</span>
                  <span className="text-[11px] text-amber-600">{c.category.replace(/_/g, ' ')}</span>
                  {c.nextReviewDate && (
                    <span className={`ml-auto text-[11px] font-medium ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                      {isOverdue ? 'Overdue — ' : ''}{new Date(c.nextReviewDate).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
