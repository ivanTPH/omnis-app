'use client'

import { useState } from 'react'
import { LayoutGrid, Wand2 } from 'lucide-react'
import type { GeneratedResourceData } from '@/app/actions/ai-generator'
import ResourceGeneratorForm from './ResourceGeneratorForm'
import ResourcePreview from './ResourcePreview'
import ResourceLibrary from './ResourceLibrary'

type Props = {
  schoolId:        string
  userId:          string
  myResources:     GeneratedResourceData[]
  schoolResources: GeneratedResourceData[]
  canViewAll:      boolean
  userLessons?:    { id: string; title: string }[]
}

type RightPanel = 'preview' | 'library'

export default function AiGeneratorShell({
  schoolId,
  userId,
  myResources,
  schoolResources,
  canViewAll,
  userLessons = [],
}: Props) {
  const [rightPanel,    setRightPanel]    = useState<RightPanel>('library')
  const [preview,       setPreview]       = useState<(GeneratedResourceData & { content: string }) | null>(null)
  const [localMine,     setLocalMine]     = useState<GeneratedResourceData[]>(myResources)
  const [localSchool,   setLocalSchool]   = useState<GeneratedResourceData[]>(schoolResources)

  function handleGenerated(result: GeneratedResourceData & { content: string }) {
    setPreview(result)
    setRightPanel('preview')
    // Prepend to local copies so library is immediately up-to-date
    setLocalMine(prev => [result, ...prev])
    setLocalSchool(prev => [result, ...prev])
  }

  function handleRegenerate() {
    setPreview(null)
    setRightPanel('library')
  }

  function handleDeletePreview() {
    setPreview(null)
    setRightPanel('library')
  }

  function handleSelectFromLibrary(r: GeneratedResourceData & { content: string }) {
    setPreview(r)
    setRightPanel('preview')
  }

  return (
    <div className="flex gap-5 h-full min-h-0">
      {/* ── Left panel: form ─────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex-1 overflow-auto">
          <h2 className="text-[13px] font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wand2 size={14} className="text-blue-600" />
            Generate Resource
          </h2>
          <ResourceGeneratorForm
            schoolId={schoolId}
            onGenerated={handleGenerated}
          />
        </div>
      </div>

      {/* ── Right panel: preview or library ──────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toggle bar */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <button
            onClick={() => setRightPanel('preview')}
            disabled={!preview}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-40 ${
              rightPanel === 'preview'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Wand2 size={12} />
            Preview
          </button>
          <button
            onClick={() => setRightPanel('library')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
              rightPanel === 'library'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <LayoutGrid size={12} />
            Library
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {rightPanel === 'preview' && preview ? (
            <ResourcePreview
              resource={preview}
              onDelete={handleDeletePreview}
              onRegenerate={handleRegenerate}
              userLessons={userLessons}
            />
          ) : (
            <ResourceLibrary
              myResources={localMine}
              schoolResources={localSchool}
              userId={userId}
              canViewAll={canViewAll}
              onSelect={handleSelectFromLibrary}
            />
          )}
        </div>
      </div>
    </div>
  )
}
