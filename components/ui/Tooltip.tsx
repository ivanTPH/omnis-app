'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export default function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  const [visible, setVisible]   = useState(false)
  const [coords, setCoords]     = useState<{ x: number; y: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function calcCoords(): { x: number; y: number } | null {
    if (!triggerRef.current) return null
    const r = triggerRef.current.getBoundingClientRect()
    switch (side) {
      case 'top':    return { x: r.left + r.width / 2, y: r.top }
      case 'bottom': return { x: r.left + r.width / 2, y: r.bottom }
      case 'left':   return { x: r.left,               y: r.top + r.height / 2 }
      case 'right':  return { x: r.right,              y: r.top + r.height / 2 }
    }
  }

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const c = calcCoords()
      if (c) {
        setCoords(c)
        setVisible(true)
      }
    }, 150)
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
    setCoords(null)
  }

  // fixed-position style so the portal bubble is never clipped by overflow:hidden
  const bubbleStyle: React.CSSProperties = coords ? (() => {
    const GAP = 6
    switch (side) {
      case 'top':    return { position: 'fixed', left: coords.x, top: coords.y - GAP,    transform: 'translateX(-50%) translateY(-100%)' }
      case 'bottom': return { position: 'fixed', left: coords.x, top: coords.y + GAP,    transform: 'translateX(-50%)' }
      case 'left':   return { position: 'fixed', left: coords.x - GAP, top: coords.y,    transform: 'translateX(-100%) translateY(-50%)' }
      case 'right':  return { position: 'fixed', left: coords.x + GAP, top: coords.y,    transform: 'translateY(-50%)' }
    }
  })() : {}

  return (
    <span
      ref={triggerRef}
      className={`inline-flex items-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {mounted && visible && coords && createPortal(
        <span
          role="tooltip"
          style={{ zIndex: 9999, pointerEvents: 'none', maxWidth: '200px', ...bubbleStyle }}
          className="rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg"
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  )
}
