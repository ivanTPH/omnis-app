/**
 * Pupils whose school email address is not yet known get an account with a
 * placeholder address on the reserved `.invalid` domain (RFC 2606), so it can
 * never be delivered. Invitations are only sent to real addresses.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'pending.omnis.invalid'

export function placeholderEmail(wondeId: string): string {
  return `${wondeId.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@${PLACEHOLDER_EMAIL_DOMAIN}`
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}

/** Basic shape check for an address supplied by the MIS or a CSV. */
export function isUsableEmail(email: string | null | undefined): email is string {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !isPlaceholderEmail(e) && !e.endsWith('.invalid')
}
