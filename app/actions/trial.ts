'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type TrialStatus =
  | { active: true;  daysLeft: number; trialEndsAt: string }
  | { active: false; daysLeft: 0;      trialEndsAt: string }
  | null  // no trial (full account)

/**
 * Returns trial status for the current user.
 * Reads from the JWT first; falls back to DB for sessions that predate
 * the trialEndsAt field being added to the token.
 */
export async function getTrialStatus(): Promise<TrialStatus> {
  const session = await auth()
  if (!session?.user?.id) return null

  // Try JWT first (fastest path)
  let trialEndsAt = (session.user as any).trialEndsAt as string | null | undefined

  // Fallback: read from DB if not in JWT (pre-existing sessions)
  if (!trialEndsAt) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { trialEndsAt: true },
    })
    if (!user?.trialEndsAt) return null
    trialEndsAt = user.trialEndsAt.toISOString()
  }

  const msLeft   = new Date(trialEndsAt).getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))

  return daysLeft > 0
    ? { active: true,  daysLeft, trialEndsAt }
    : { active: false, daysLeft: 0, trialEndsAt }
}
