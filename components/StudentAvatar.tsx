'use client'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_PX: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56 }

const COLOURS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#6366f1', '#ef4444', '#14b8a6',
]

function colourFromName(first: string, last: string): string {
  const hash = (first.charCodeAt(0) ?? 0) + (last.charCodeAt(0) ?? 0)
  return COLOURS[hash % COLOURS.length]
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
  firstName,
  lastName,
  avatarUrl,
  size = 'sm',
  showName = false,
  className = '',
}: Props) {
  const px      = SIZE_PX[size]
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
  const bg       = colourFromName(firstName, lastName)

  const circleStyle: React.CSSProperties = {
    width:          px,
    height:         px,
    borderRadius:   '50%',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontWeight:     600,
    fontSize:       Math.round(px * 0.35),
    color:          '#ffffff',
    backgroundColor: bg,
  }

  const imgStyle: React.CSSProperties = {
    width:        px,
    height:       px,
    borderRadius: '50%',
    objectFit:    'cover',
    flexShrink:   0,
    display:      'block',
  }

  const avatar = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={`${firstName} ${lastName}`}
      style={imgStyle}
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  ) : (
    <div style={circleStyle} aria-label={`${firstName} ${lastName}`}>
      {initials}
    </div>
  )

  if (!showName) {
    return <span className={className} style={{ display: 'inline-flex', flexShrink: 0 }}>{avatar}</span>
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {avatar}
      <span style={{ fontWeight: 500, color: '#111827' }}>{firstName} {lastName}</span>
    </span>
  )
}
