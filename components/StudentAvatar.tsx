'use client'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_PX: Record<Size, number> = {
  xs:  24,
  sm:  32,
  md:  40,
  lg:  56,
}

const SIZE_TEXT: Record<Size, string> = {
  xs:  'text-[9px]',
  sm:  'text-[11px]',
  md:  'text-[13px]',
  lg:  'text-[18px]',
}

const COLOURS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
]

function colourFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLOURS[Math.abs(hash) % COLOURS.length]
}

type Props = {
  firstName: string
  lastName:  string
  avatarUrl?: string | null
  size?:     Size
  showName?: boolean
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
  const colour  = colourFromName(`${firstName}${lastName}`)
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`

  const avatar = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={`${firstName} ${lastName}`}
      width={px}
      height={px}
      className="rounded-full object-cover shrink-0"
      style={{ width: px, height: px }}
    />
  ) : (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 ${colour} ${SIZE_TEXT[size]}`}
      style={{ width: px, height: px }}
      aria-label={`${firstName} ${lastName}`}
    >
      {initials}
    </div>
  )

  if (!showName) return <span className={className}>{avatar}</span>

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {avatar}
      <span className="font-medium text-gray-900">{firstName} {lastName}</span>
    </span>
  )
}
