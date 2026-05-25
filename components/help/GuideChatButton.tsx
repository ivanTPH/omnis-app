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
        className="fixed bottom-5 right-5 z-30 w-12 h-12 rounded-full bg-blue-700 text-white shadow-lg flex items-center justify-center hover:bg-blue-800 hover:scale-105 active:scale-95 transition-all"
      >
        <Icon name="help" size="md" />
      </button>

      {open && <GuideChatSlideOver onClose={() => setOpen(false)} />}
    </>
  )
}
