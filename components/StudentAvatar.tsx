'use client'
import { useState } from 'react'

type Size       = 'xs' | 'sm' | 'md' | 'lg'
type SendStatus = 'NONE' | 'SEN_SUPPORT' | 'EHCP' | null | undefined

const SIZES: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56 }

// Colour is reserved for the SEND ring — initials always use neutral grey
const INITIALS_BG = '#9ca3af'

// White 2px gap then 3px solid colour ring
const RING_SHADOW: Record<string, string> = {
  SEN_SUPPORT: '0 0 0 2px #ffffff, 0 0 0 5px #3b82f6',
  EHCP:        '0 0 0 2px #ffffff, 0 0 0 5px #8b5cf6',
}

type Props = {
  firstName:   string
  lastName:    string
  avatarUrl?:  string | null
  size?:       Size
  showName?:   boolean
  className?:  string
  sendStatus?: SendStatus
}

export default function StudentAvatar({
  firstName  = '',
  lastName   = '',
  avatarUrl,
  size       = 'sm',
  showName   = false,
  className  = '',
  sendStatus,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const px        = SIZES[size]
  const initials  = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const ringStyle = sendStatus && sendStatus !== 'NONE' ? RING_SHADOW[sendStatus] : undefined

  const circleStyle: React.CSSProperties = {
    width:           px,
    height:          px,
    borderRadius:    '50%',
    flexShrink:      0,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: INITIALS_BG,
    color:           'white',
    fontSize:        Math.round(px * 0.38),
    fontWeight:      600,
    letterSpacing:   '0.02em',
    userSelect:      'none',
    boxShadow:       ringStyle,
  }

  const avatar = (!avatarUrl || imgFailed) ? (
    <div style={circleStyle} aria-label={`${firstName} ${lastName}`}>
      {initials}
    </div>
  ) : (
    // Wrapper carries the ring so it stays outside the photo
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0, borderRadius: '50%', boxShadow: ringStyle }}>
      <div style={{ ...circleStyle, position: 'absolute', top: 0, left: 0, boxShadow: undefined }}>
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
