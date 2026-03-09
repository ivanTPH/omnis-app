'use client'

import { useState, useTransition } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { marked } from 'marked'
import type { GeneratedResourceData } from '@/app/actions/ai-generator'
import { deleteGeneratedResource } from '@/app/actions/ai-generator'
import ResourceTypeIcon, { RESOURCE_TYPE_LABELS } from './ResourceTypeIcon'

type Props = {
  resource: GeneratedResourceData
  canDelete: boolean
  onDelete: (id: string) => void
  onSelect?: () => void
}

const TYPE_COLOURS: Record<string, string> = {
  worksheet:           'bg-blue-100 text-blue-700',
  quiz:                'bg-amber-100 text-amber-700',
  lesson_plan:         'bg-green-100 text-green-700',
  exit_ticket:         'bg-rose-100 text-rose-700',
  knowledge_organiser: 'bg-purple-100 text-purple-700',
}

export default function ResourceCard({ resource, canDelete, onDelete, onSelect }: Props) {
  const [expanded, setExpanded]   = useState(false)
  const [deleting, startDelete]   = useTransition()

  const html = expanded
    ? String(marked.parse(resource.content))
    : ''

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    startDelete(async () => {
      await deleteGeneratedResource(resource.id)
      onDelete(resource.id)
    })
  }

  const typeLabel  = RESOURCE_TYPE_LABELS[resource.resourceType] ?? resource.resourceType
  const typeColour = TYPE_COLOURS[resource.resourceType] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => { setExpanded(e => !e); onSelect?.() }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${typeColour}`}>
              <ResourceTypeIcon type={resource.resourceType} size={10} />
              {typeLabel}
            </span>
            {resource.sendAdapted && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 shrink-0">
                SEND
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-gray-800 leading-snug truncate">{resource.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {resource.subject} · {resource.yearGroup} · {new Date(resource.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
          <div
            className="prose prose-sm max-w-none text-[12px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {resource.sendNotes && (
            <p className="mt-3 text-[11px] text-purple-600 bg-purple-50 px-2.5 py-1.5 rounded-lg">
              SEND: {resource.sendNotes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
