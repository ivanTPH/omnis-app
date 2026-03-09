'use client'

import { useState } from 'react'
import type { CoverSummary, CoverHistoryEntry } from '@/app/actions/cover'
import CoverDashboard from './CoverDashboard'
import CoverHistoryTable from './CoverHistoryTable'

type StaffMember = { id: string; firstName: string; lastName: string; title: string | null }

type Props = {
  today:     Date
  schoolId:  string
  summary:   CoverSummary
  history:   CoverHistoryEntry[]
  staffList: StaffMember[]
}

export default function CoverPageTabs({ today, schoolId, summary, history, staffList }: Props) {
  const [tab, setTab] = useState<'today' | 'history'>('today')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 flex-shrink-0">
        {(['today', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-colors capitalize ${
              tab === t
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {t === 'today' ? "Today's Cover" : 'History'}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'today' ? (
          <CoverDashboard
            schoolId={schoolId}
            initial={summary}
            staffList={staffList}
            date={today}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-auto">
            <CoverHistoryTable history={history} />
          </div>
        )}
      </div>
    </div>
  )
}
