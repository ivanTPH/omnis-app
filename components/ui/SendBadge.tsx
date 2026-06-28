/**
 * SendBadge — standardised SEND status badge with Feb 2026 White Paper tier labels.
 *
 * Tier mapping (digital-ISP framework):
 *   EHCP        → Specialist
 *   SEN_SUPPORT → Targeted / Targeted-Plus (SEN Support)
 *   NONE        → Universal (hidden — not displayed)
 *
 * Props:
 *   status  — SEND status value from DB
 *   size    — 'sm' (default) or 'md'
 *   showTier — show White Paper tier label alongside status (default false)
 */
type SendStatus = 'EHCP' | 'SEN_SUPPORT' | 'NONE' | null | undefined

export default function SendBadge({
  status,
  size = 'sm',
  showTier = false,
}: {
  status:    SendStatus
  size?:     'sm' | 'md'
  showTier?: boolean
}) {
  if (!status || status === 'NONE') return null

  const base = size === 'md'
    ? 'text-sm px-2.5 py-1 rounded-full font-medium border'
    : 'text-xs px-2 py-0.5 rounded-full font-medium border'

  if (status === 'EHCP') {
    return (
      <span className={`${base} bg-purple-100 text-purple-700 border-purple-200`} title="Specialist tier — Education, Health and Care Plan">
        EHCP{showTier && ' · Specialist'}
      </span>
    )
  }

  return (
    <span className={`${base} bg-blue-100 text-blue-700 border-blue-200`} title="Targeted tier — SEN Support">
      SEN Support{showTier && ' · Targeted'}
    </span>
  )
}
