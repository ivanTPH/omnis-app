'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const OWNER_EMAIL = 'ivanyardley@me.com'

/** Must stay in sync with the demo-account lists in DemoRoleSwitcher.tsx and DemoRolePicker.tsx. */
const DEMO_SWITCH_EMAILS = new Set([
  OWNER_EMAIL,
  'j.patel@omnisdemo.school', 'r.morris@omnisdemo.school', 't.adeyemi@omnisdemo.school',
  'd.brooks@omnisdemo.school', 'c.roberts@omnisdemo.school', 'admin@omnisdemo.school',
  'j.taylor@omnisdemo.school', 'a.hughes@students.omnisdemo.school', 'l.hughes@parents.omnisdemo.school',
  'academy@omnis.edu', 'platform@omnis.edu',
])

/** Returns the current signed-in user's email — used by DemoRoleSwitcher. */
export async function getDemoSessionEmail(): Promise<string | null> {
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (session?.user as any)?.email ?? null
  } catch {
    return null
  }
}

/**
 * Revokes a PREVIOUS demo-switch session server-side, by email rather than
 * by the caller's own current session — used after a role switch has
 * already completed, at which point the caller is authenticated as the
 * NEW account, not the one being switched away from.
 *
 * This is deliberately narrow: `email` must be the owner or one of the
 * fixed demo accounts (never an arbitrary address), and the caller must
 * themselves currently be signed in as one of those same accounts — i.e.
 * this can only be used to revoke one demo-switch session from within
 * another, which is the one thing the demo role switcher needs it for.
 *
 * See DemoRoleSwitcher.tsx / DemoRolePicker.tsx for why this exists: the
 * switch flow must clear the browser's session cookie before calling
 * signIn() again (NextAuth v5 beta hangs otherwise if still authenticated),
 * but that must not be confused with revoking the previous session server-
 * side — that revocation is deferred until the new sign-in is confirmed to
 * have worked, so a failed switch never invalidates a still-good session.
 */
export async function revokePreviousDemoSession(email: string): Promise<void> {
  // Never the owner: the demo accounts' passwords are public, so anyone
  // signed in as one could otherwise call this to log the owner out at will.
  // The owner's session is revoked only by the owner, via recordSignOut(),
  // while still signed in as the owner.
  if (email === OWNER_EMAIL || !DEMO_SWITCH_EMAILS.has(email)) return
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callerEmail = (session?.user as any)?.email ?? null
  if (!callerEmail || !DEMO_SWITCH_EMAILS.has(callerEmail)) return

  await prisma.user.updateMany({
    where: { email },
    data:  { sessionsInvalidatedAt: new Date() },
  })
}
