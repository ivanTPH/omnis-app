'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import type { SchoolRow } from '@/app/actions/platform-admin'
import { toggleSchoolActive } from '@/app/actions/platform-admin'
import SchoolForm from './SchoolForm'
import FeatureFlagPanel from './FeatureFlagPanel'

const PHASE_LABELS: Record<string, string> = {
  primary:     'Primary',
  secondary:   'Secondary',
  all_through: 'All-Through',
  special:     'Special',
}

type Props = { schools: SchoolRow[] }

export default function SchoolListTable({ schools: initial }: Props) {
  const [showForm,    setShowForm]    = useState(false)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [pending,     start]          = useTransition()
  const [togglingId,  setTogglingId]  = useState<string | null>(null)

  function handleToggle(id: string) {
    setTogglingId(id)
    start(async () => {
      await toggleSchoolActive(id)
      setTogglingId(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{initial.length} school{initial.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <Icon name="add" size="sm" /> Add School
        </button>
      </div>

      {showForm && <SchoolForm onDone={() => setShowForm(false)} />}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">URN</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Phase</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Region</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-600">Students</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-600">Staff</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Onboarded</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {initial.map(s => (
              <>
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{s.name}</td>
                  <td className="px-3 py-3 text-gray-400 font-mono">{s.urn ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{s.phase ? PHASE_LABELS[s.phase] ?? s.phase : '—'}</td>
                  <td className="px-3 py-3 text-gray-500">{s.region ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-gray-700">{s.studentCount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-gray-700">{s.staffCount.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                    {s.onboardedAt ? new Date(s.onboardedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpanded(e => e === s.id ? null : s.id)}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        Flags {expanded === s.id ? <Icon name="expand_less" size="sm" /> : <Icon name="expand_more" size="sm" />}
                      </button>
                      <button
                        onClick={() => handleToggle(s.id)}
                        disabled={pending && togglingId === s.id}
                        className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                        title={s.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {s.isActive
                          ? <Icon name="toggle_on" size="md" className="text-green-500" />
                          : <Icon name="toggle_off" size="md" />}
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === s.id && (
                  <tr key={`${s.id}-flags`}>
                    <td colSpan={9} className="px-6 pb-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-2 mb-1">Feature Flags — {s.name}</p>
                      <FeatureFlagPanel schoolId={s.id} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {initial.length === 0 && (
          <p className="text-center py-8 text-[13px] text-gray-400">No schools yet. Add the first one above.</p>
        )}
      </div>
    </div>
  )
}
