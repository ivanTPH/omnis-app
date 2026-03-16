'use client'
import { useState } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56 }

const COLOURS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#6366f1', '#ef4444', '#14b8a6',
  '#f97316', '#06b6d4',
]

function getColour(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLOURS[Math.abs(hash) % COLOURS.length]
}

type Props = {
  firstName:  string
  lastName:   string
  avatarUrl?: string | null
  size?:      Size
  showName?:  boolean
  className?: string
}

export default function StudentAvatar({
  firstName  = '',
  lastName   = '',
  avatarUrl,
  size       = 'sm',
  showName   = false,
  className  = '',
}: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const px       = SIZES[size]
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const bg       = getColour(firstName + lastName)

  const circleStyle: React.CSSProperties = {
    width:           px,
    height:          px,
    borderRadius:    '50%',
    flexShrink:      0,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: bg,
    color:           'white',
    fontSize:        Math.round(px * 0.38),
    fontWeight:      600,
    letterSpacing:   '0.02em',
    userSelect:      'none',
  }

  const avatar = (!avatarUrl || imgFailed) ? (
    <div style={circleStyle} aria-label={`${firstName} ${lastName}`}>
      {initials}
    </div>
  ) : (
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }}>
      {/* Initials underneath — visible while image loads or if it fails */}
      <div style={{ ...circleStyle, position: 'absolute', top: 0, left: 0 }}>
        {initials}
      </div>
      <img
        src={avatarUrl}
        alt={initials}
        style={{
          width:        px,
          height:       px,
          borderRadius: '50%',
          objectFit:    'cover',
          position:     'absolute',
          top:          0,
          left:         0,
          display:      'block',
        }}
        onError={() => setImgFailed(true)}
      />
    </div>
  )

  if (!showName) {
    return (
      <span className={className} style={{ display: 'inline-flex', flexShrink: 0 }}>
        {avatar}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {avatar}
      <span style={{ fontWeight: 500, color: '#111827' }}>{firstName} {lastName}</span>
    </span>
  )
}
