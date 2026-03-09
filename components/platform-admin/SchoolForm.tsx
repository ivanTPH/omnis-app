'use client'

import { useState, useTransition } from 'react'
import { createSchool } from '@/app/actions/platform-admin'

const PHASE_OPTIONS = [
  { value: 'primary',     label: 'Primary'     },
  { value: 'secondary',   label: 'Secondary'   },
  { value: 'all_through', label: 'All-Through'  },
  { value: 'special',     label: 'Special'     },
]

type Props = { onDone: () => void }

export default function SchoolForm({ onDone }: Props) {
  const [name,          setName]          = useState('')
  const [urn,           setUrn]           = useState('')
  const [phase,         setPhase]         = useState('secondary')
  const [localAuthority, setLocalAuthority] = useState('')
  const [region,        setRegion]        = useState('')
  const [error,         setError]         = useState('')
  const [pending, start]                  = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('School name is required'); return }
    if (!urn.trim())  { setError('URN is required'); return }
    setError('')
    start(async () => {
      await createSchool({ name, urn, phase, localAuthority, region })
      onDone()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
      <h3 className="text-[13px] font-semibold text-gray-800">Add School</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">School Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Riverside Academy"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">URN</label>
          <input type="text" value={urn} onChange={e => setUrn(e.target.value)}
            placeholder="e.g. 123456"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Phase</label>
          <select value={phase} onChange={e => setPhase(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {PHASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Region</label>
          <input type="text" value={region} onChange={e => setRegion(e.target.value)}
            placeholder="e.g. London"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Local Authority</label>
          <input type="text" value={localAuthority} onChange={e => setLocalAuthority(e.target.value)}
            placeholder="e.g. Tower Hamlets"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onDone}
          className="px-3 py-1.5 text-[12px] text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
        <button type="submit" disabled={pending}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50">
          {pending ? 'Creating…' : 'Create School'}
        </button>
      </div>
    </form>
  )
}
