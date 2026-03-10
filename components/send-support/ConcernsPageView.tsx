'use client'

import { useState } from 'react'
import type { ConcernRow } from '@/app/actions/send-support'
import ConcernList from './ConcernList'

const STATUSES = ['all', 'open', 'under_review', 'escalated', 'monitoring', 'closed', 'no_action']
const CATEGORIES = ['all', 'literacy', 'numeracy', 'behaviour', 'attendance', 'social_emotional', 'communication', 'physical', 'sensory', 'other']

type Props = { initialConcerns: ConcernRow[] }

export default function ConcernsPageView({ initialConcerns }: Props) {
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = initialConcerns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Category</label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="self-end">
          <span className="text-sm text-gray-500">{filtered.length} concern{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <ConcernList concerns={filtered} isSenco={true} />
      </div>
    </div>
  )
}
