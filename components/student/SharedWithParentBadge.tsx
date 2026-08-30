import Icon from '@/components/ui/Icon'

/**
 * ICO Children's Code Standard 11 — a visible, always-accurate indicator of
 * what's shared with a linked parent/carer. Purely presentational: the caller
 * decides whether to render it (via getMyParentShareStatus()) so the badge
 * never claims sharing that isn't actually true for that student.
 */
export default function SharedWithParentBadge() {
  return (
    <span
      title="Your parent/carer can see this in their Omnis dashboard"
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
    >
      <Icon name="family_restroom" size="sm" />
      Visible to your parent
    </span>
  )
}
