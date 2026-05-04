import React from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

interface BadgeDef {
  label: string
  variant: 'high' | 'medium' | 'low' | 'open' | 'resolved' | 'published' | 'draft' | 'custom'
  customClass?: string
}

interface MetaItem {
  label: string
  value: string
}

interface SencoRowProps {
  studentName:      string
  studentInitials:  string
  avatarColour?:    string
  studentHref?:     string
  badges?:          BadgeDef[]
  meta?:            MetaItem[]
  rightContent?:    React.ReactNode
  isExpanded:       boolean
  onToggle:         () => void
  children?:        React.ReactNode
}

function badgeClass(b: BadgeDef): string {
  if (b.variant === 'high')      return 'badge-high'
  if (b.variant === 'medium')    return 'badge-medium'
  if (b.variant === 'low')       return 'badge-low'
  if (b.variant === 'resolved')  return 'badge-resolved'
  if (b.variant === 'published') return 'text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700'
  if (b.variant === 'draft')     return 'text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700'
  if (b.variant === 'custom')    return b.customClass ?? 'badge-open'
  return 'badge-open'
}

export function SencoRow({
  studentName,
  studentInitials,
  avatarColour = 'bg-gray-400',
  studentHref,
  badges,
  meta,
  rightContent,
  isExpanded,
  onToggle,
  children,
}: SencoRowProps) {
  return (
    <div className={`senco-row${isExpanded ? ' expanded' : ''}`}>

      {/* HEADER — always visible */}
      <div className="senco-row-header" onClick={onToggle}>

        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full ${avatarColour} flex items-center justify-center flex-shrink-0`}>
          <span className="text-xs font-semibold text-white">{studentInitials}</span>
        </div>

        {/* Name + badges */}
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          {studentHref ? (
            <Link
              href={studentHref}
              onClick={e => e.stopPropagation()}
              className="text-data hover:text-blue-700 hover:underline"
            >
              {studentName}
            </Link>
          ) : (
            <span className="text-data">{studentName}</span>
          )}
          {badges?.map((b, i) => (
            <span key={i} className={badgeClass(b)}>{b.label}</span>
          ))}
        </div>

        {/* Right content (action buttons, dates, etc.) */}
        {rightContent && (
          <div
            className="flex items-center gap-2 flex-shrink-0"
            onClick={e => e.stopPropagation()}
          >
            {rightContent}
          </div>
        )}

        {/* Chevron */}
        <div
          className="ml-2 flex-shrink-0 transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <Icon name="expand_more" size="sm" className="text-gray-400" />
        </div>
      </div>

      {/* Meta grid — always visible */}
      {meta && meta.length > 0 && (
        <div className="senco-meta-grid">
          {meta.map((m, i) => (
            <div key={i} className="senco-meta-item">
              <span className="text-label">{m.label}</span>
              <span className="text-data text-sm">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && children && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

export default SencoRow
