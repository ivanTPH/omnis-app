'use client'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { ThreadSummary, ThreadDetail } from '@/app/actions/messaging'
import { getThread, getMyThreads } from '@/app/actions/messaging'
import ThreadList from './ThreadList'
import ThreadView from './ThreadView'
import NewThreadModal from './NewThreadModal'

export default function MessagingShell({
  initialThreads,
  initialThreadId,
  currentUserId,
}: {
  initialThreads:   ThreadSummary[]
  initialThreadId?: string | null
  currentUserId:    string
}) {
  const [threads,       setThreads]       = useState(initialThreads)
  const [activeId,      setActiveId]      = useState<string | null>(initialThreadId ?? null)
  const [activeThread,  setActiveThread]  = useState<ThreadDetail | null>(null)
  const [showNew,       setShowNew]       = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)

  // Load thread when activeId changes
  useEffect(() => {
    if (!activeId) { setActiveThread(null); return }
    setLoadingThread(true)
    getThread(activeId).then(t => setActiveThread(t)).finally(() => setLoadingThread(false))
  }, [activeId])

  // Refresh thread list when a thread is archived
  async function handleArchived() {
    setActiveId(null)
    setActiveThread(null)
    const updated = await getMyThreads()
    setThreads(updated)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel — thread list */}
      <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-[14px] font-semibold text-gray-900">Messages</h1>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Icon name="edit_note" size="sm" />
            New
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ThreadList
            threads={threads}
            activeThreadId={activeId}
            onSelect={setActiveId}
          />
        </div>
      </div>

      {/* Right panel — thread or empty */}
      <div className="flex-1 min-w-0 bg-white flex flex-col">
        {loadingThread ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeThread ? (
          <ThreadView
            thread={activeThread}
            currentUserId={currentUserId}
            onArchived={handleArchived}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Icon name="edit_note" size="lg" className="opacity-20" />
            <p className="text-[13px]">Select a conversation or start a new one</p>
            <button
              onClick={() => setShowNew(true)}
              className="text-[13px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors"
            >
              + New Message
            </button>
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      {showNew && (
        <NewThreadModal onClose={() => setShowNew(false)} />
      )}
    </div>
  )
}
