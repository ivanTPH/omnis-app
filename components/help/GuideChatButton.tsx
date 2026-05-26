'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import GuideChatSlideOver from './GuideChatSlideOver'

export default function GuideChatButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Omnis Guide"
        title="Ask the Omnis Guide"
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-blue-700 text-white shadow-xl hover:bg-blue-800 hover:scale-105 active:scale-95 transition-all"
      >
        <Icon name="auto_awesome" size="sm" />
        <span className="text-sm font-semibold">Guide</span>
      </button>

      {open && <GuideChatSlideOver onClose={() => setOpen(false)} />}
    </>
  )
}
