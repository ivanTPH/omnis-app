'use client'

import { useState, useTransition, useMemo } from 'react'
import Icon from '@/components/ui/Icon'
import { marked } from 'marked'
import type { GeneratedResourceData } from '@/app/actions/ai-generator'
import { deleteGeneratedResource, linkResourceToLesson } from '@/app/actions/ai-generator'
import ResourceTypeIcon, { RESOURCE_TYPE_LABELS } from './ResourceTypeIcon'
import SlideOutlinePreview from './SlideOutlinePreview'

type Props = {
  resource: GeneratedResourceData & { content: string }
  onDelete?: () => void
  onRegenerate?: () => void
  userLessons?: { id: string; title: string }[]
}

export default function ResourcePreview({ resource, onDelete, onRegenerate, userLessons = [] }: Props) {
  const [copied,       setCopied]       = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState('')
  const [pending, start]               = useTransition()
  const [deleting, startDelete]        = useTransition()

  const html = useMemo(() => {
    // marked.parse is sync when async:false (default in v17)
    const result = marked.parse(resource.content)
    return typeof result === 'string' ? result : ''
  }, [resource.content])

  function handleCopy() {
    navigator.clipboard.writeText(resource.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteGeneratedResource(resource.id)
      onDelete?.()
    })
  }

  function handleLink() {
    if (!selectedLesson) return
    start(async () => {
      await linkResourceToLesson(resource.id, selectedLesson)
      setShowLinkModal(false)
    })
  }

  const typeLabel = RESOURCE_TYPE_LABELS[resource.resourceType] ?? resource.resourceType

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{resource.title}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <ResourceTypeIcon type={resource.resourceType} size={11} />
              {typeLabel}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-[11px] text-gray-500">{resource.subject} · {resource.yearGroup}</span>
            {resource.sendAdapted && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[11px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                  SEND adapted
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onRegenerate && (
            <button onClick={onRegenerate} title="Regenerate"
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Icon name="refresh" size="sm" />
            </button>
          )}
          {userLessons.length > 0 && (
            <button onClick={() => setShowLinkModal(true)} title="Link to lesson"
              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
              <Icon name="link" size="sm" />
            </button>
          )}
          <button onClick={handleCopy} title="Copy to clipboard"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            {copied ? <Icon name="check" size="sm" className="text-green-600" /> : <Icon name="content_copy" size="sm" />}
          </button>
          <button onClick={handleDelete} disabled={deleting} title="Delete resource"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
            <Icon name="delete" size="sm" />
          </button>
        </div>
      </div>

      {/* Link to lesson modal */}
      {showLinkModal && (
        <div className="mb-3 p-3 border border-green-200 bg-green-50 rounded-xl flex-shrink-0">
          <p className="text-[12px] font-semibold text-gray-700 mb-2">Link to a lesson</p>
          <select
            value={selectedLesson}
            onChange={e => setSelectedLesson(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none mb-2"
          >
            <option value="">Select a lesson…</option>
            {userLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleLink} disabled={!selectedLesson || pending}
              className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-50">
              {pending ? 'Linking…' : 'Link'}
            </button>
            <button onClick={() => setShowLinkModal(false)}
              className="px-3 py-1 text-[11px] text-gray-500 hover:text-gray-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {resource.resourceType === 'powerpoint_outline' ? (
        <div className="flex-1 overflow-hidden">
          <SlideOutlinePreview content={resource.content} deckTitle={resource.title} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-xl p-5">
          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  )
}
