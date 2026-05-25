'use client'
import Tooltip from './Tooltip'

export default function InfoTip({
  content,
  side = 'top',
}: {
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <Tooltip content={content} side={side}>
      <span
        tabIndex={0}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold cursor-help select-none ml-1 shrink-0 hover:bg-gray-300 transition-colors"
        aria-label={content}
      >
        i
      </span>
    </Tooltip>
  )
}
