'use client'
import { useState } from 'react'

type Size       = 'xs' | 'sm' | 'md' | 'lg'
type SendStatus = 'NONE' | 'SEN_SUPPORT' | 'EHCP' | null | undefined

const SIZES: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56 }

// 10 distinct colours, all the 700 shade so white initials meet WCAG AA
// (4.5:1). The 500 shades used before were as low as 2.1:1 (amber).
const PALETTE = [
  '#1d4ed8', // blue-700
  '#6d28d9', // violet-700
  '#be185d', // pink-700
  '#b45309', // amber-700
  '#047857', // emerald-700
  '#b91c1c', // red-700
  '#4338ca', // indigo-700
  '#0f766e', // teal-700
  '#c2410c', // orange-700
  '#4d7c0f', // lime-700
]

/** Deterministic colour derived from the student's full name */
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// White 2px gap then 3px solid colour ring for SEND indicators
const RING_SHADOW: Record<string, string> = {
  SEN_SUPPORT: '0 0 0 2px #ffffff, 0 0 0 5px #3b82f6',
  EHCP:        '0 0 0 2px #ffffff, 0 0 0 5px #8b5cf6',
}

type Props = {
  firstName:   string
  lastName:    string
  avatarUrl?:  string | null
  /** When provided, the proxy URL /api/student-photo/{userId} is used as the
   *  image src so Wonde photo URLs are fetched server-side with auth headers. */
  userId?:     string | null
  size?:       Size
  showName?:   boolean
  className?:  string
  sendStatus?: SendStatus
}

export default function StudentAvatar({
  firstName  = '',
  lastName   = '',
  avatarUrl,
  userId,
  size       = 'sm',
  showName   = false,
  className  = '',
  sendStatus,
}: Props) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const px        = SIZES[size]
  const initials  = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const bgColor   = nameToColor(`${firstName}${lastName}`)
  const ringStyle = sendStatus && sendStatus !== 'NONE' ? RING_SHADOW[sendStatus] : undefined

  // avatarUrl is usually /api/student-photo/{id}; without one, ask that route
  // by userId (it returns the photo, a demo avatar or initials). No pupil name
  // is ever sent to an outside avatar service.
  const photoSrc  = avatarUrl ?? (userId ? `/api/student-photo/${userId}` : null)
  const showPhoto = !!photoSrc && !imgFailed

  const circleBase: React.CSSProperties = {
    width:           px,
    height:          px,
    borderRadius:    '50%',
    flexShrink:      0,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: bgColor,
    color:           'white',
    fontSize:        Math.round(px * 0.38),
    fontWeight:      600,
    letterSpacing:   '0.02em',
    userSelect:      'none',
  }

  const avatar = (
    <div
      style={{
        position:     'relative',
        width:        px,
        height:       px,
        flexShrink:   0,
        borderRadius: '50%',
        overflow:     'hidden',
        boxShadow:    ringStyle,
      }}
      aria-label={`${firstName} ${lastName}`}
    >
      {/* Coloured initials — always visible until/unless a photo loads */}
      <div style={{ ...circleBase, position: 'absolute', inset: 0, boxShadow: undefined }}>
        {initials}
      </div>

      {/* Photo (or generated avatar from the photo route); opacity 0 until loaded */}
      {showPhoto && (
        <img
          src={photoSrc!}
          alt=""
          style={{
            position:   'absolute',
            inset:      0,
            width:      px,
            height:     px,
            borderRadius: '50%',
            objectFit:  'cover',
            display:    'block',
            opacity:    imgLoaded ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
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
