'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'

const STORAGE_KEY = 'adaptive_info_dismissed'

export default function AdaptiveInfoPanel() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-5">
      <button
        onClick={dismiss}
        title="Dismiss"
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-gray-700 transition-colors"
      >
        <Icon name="close" size="sm" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon name="psychology" size="sm" className="text-white" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-gray-900 mb-1">About Adaptive Learning</h3>
          <p className="text-[12px] text-gray-600 leading-relaxed">
            Adaptive Learning tracks each student&apos;s topic-by-topic performance, identifies gaps, and lets you generate targeted revision in one click.
          </p>
          <div className="flex items-center gap-5 mt-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Icon name="track_changes" size="sm" className="text-blue-500" />
              Topic gap detection across the last term
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Icon name="bolt" size="sm" className="text-amber-500" />
              One-click targeted revision generation
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
