'use client'

import { useState } from 'react'
import type { ConsentPurposeData, ConsentMatrixStudent, DsrRow } from '@/app/actions/gdpr'
import ConsentPurposeList from './ConsentPurposeList'
import ConsentMatrix from './ConsentMatrix'
import DataSubjectRequestList from './DataSubjectRequestList'

type Tab = 'purposes' | 'matrix' | 'dsr'

type Props = {
  schoolId: string
  purposes: ConsentPurposeData[]
  matrixPurposes: ConsentPurposeData[]
  students: ConsentMatrixStudent[]
  dsrs: DsrRow[]
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'purposes', label: 'Consent Purposes' },
  { id: 'matrix',   label: 'Consent Matrix'   },
  { id: 'dsr',      label: 'Data Subject Requests' },
]

export default function GdprAdminShell({ schoolId, purposes, matrixPurposes, students, dsrs }: Props) {
  const [tab, setTab] = useState<Tab>('purposes')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'purposes' && (
        <ConsentPurposeList purposes={purposes} schoolId={schoolId} />
      )}
      {tab === 'matrix' && (
        <ConsentMatrix purposes={matrixPurposes} students={students} schoolId={schoolId} />
      )}
      {tab === 'dsr' && (
        <DataSubjectRequestList dsrs={dsrs} />
      )}
    </div>
  )
}
