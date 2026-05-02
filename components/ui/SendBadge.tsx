type SendStatus = 'EHCP' | 'SEN_SUPPORT' | 'NONE' | null | undefined

export default function SendBadge({
  status,
  size = 'sm',
}: {
  status: SendStatus
  size?: 'sm' | 'md'
}) {
  if (!status || status === 'NONE') return null

  const base = size === 'md'
    ? 'text-sm px-2.5 py-1 rounded-full font-medium border'
    : 'text-xs px-2 py-0.5 rounded-full font-medium border'

  if (status === 'EHCP') {
    return (
      <span className={`${base} bg-purple-100 text-purple-700 border-purple-200`}>
        EHCP
      </span>
    )
  }

  return (
    <span className={`${base} bg-blue-100 text-blue-700 border-blue-200`}>
      SEN Support
    </span>
  )
}
