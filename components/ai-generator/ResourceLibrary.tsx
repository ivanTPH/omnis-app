'use client'

import { useState } from 'react'
import type { GeneratedResourceData } from '@/app/actions/ai-generator'
import ResourceCard from './ResourceCard'

type Props = {
  myResources:     GeneratedResourceData[]
  schoolResources: GeneratedResourceData[]
  userId:          string
  canViewAll:      boolean
  onSelect:        (resource: GeneratedResourceData & { content: string }) => void
}

const TYPE_FILTERS = [
  { value: '',                   label: 'All Types'           },
  { value: 'worksheet',          label: 'Worksheets'          },
  { value: 'quiz',               label: 'Quizzes'             },
  { value: 'powerpoint_outline', label: 'PowerPoint Outlines' },
  { value: 'reading_passage',    label: 'Reading Passages'    },
  { value: 'vocabulary_list',    label: 'Vocabulary Lists'    },
  { value: 'knowledge_organiser',label: 'Knowledge Organisers'},
]

export default function ResourceLibrary({
  myResources,
  schoolResources,
  userId,
  canViewAll,
  onSelect,
}: Props) {
  const [tab,        setTab]        = useState<'mine' | 'school'>('mine')
  const [typeFilter, setTypeFilter] = useState('')
  const [deleted,    setDeleted]    = useState<Set<string>>(new Set())

  const base = tab === 'mine' ? myResources : schoolResources
  const list = base.filter(r =>
    !deleted.has(r.id) && (typeFilter === '' || r.resourceType === typeFilter),
  )

  function handleDelete(id: string) {
    setDeleted(prev => new Set([...prev, id]))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 flex-shrink-0">
        <button
          onClick={() => setTab('mine')}
          className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
            tab === 'mine'
              ? 'bg-blue-600 text-white'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          My Resources
        </button>
        {canViewAll && (
          <button
            onClick={() => setTab('school')}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
              tab === 'school'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            All School
          </button>
        )}
        <div className="flex-1" />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          {TYPE_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto space-y-2">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-[13px] text-gray-400">No resources yet.</p>
            <p className="text-[11px] text-gray-300 mt-1">Generate your first resource using the form.</p>
          </div>
        ) : (
          list.map(r => (
            <ResourceCard
              key={r.id}
              resource={r}
              canDelete={tab === 'mine' || r.createdBy === userId}
              onDelete={handleDelete}
              onSelect={() => onSelect(r as GeneratedResourceData & { content: string })}
            />
          ))
        )}
      </div>
    </div>
  )
}
