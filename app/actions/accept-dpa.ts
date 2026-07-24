'use server'

import { cookies } from 'next/headers'
import { auth, unstable_update } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

/**
 * Records the staff member's DPA acknowledgement.
 * @param acceptedConsents - IDs of the consent items the user ticked
 *   (data-controller | staff-obligations | audit-and-ai)
 */
export async function acceptDpa(acceptedConsents: string[] = []) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const now = new Date()
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { dpaAcceptedAt: now },
  })

  await writeAudit({
    schoolId:   session.user.schoolId as string,
    actorId:    session.user.id,
    action:     'DPA_ACCEPTED',
    targetType: 'User',
    targetId:   session.user.id,
    metadata:   {
      acceptedAt:       now.toISOString(),
      acceptedConsents,
      consentVersion:   '2026-07',
    },
  })

  // Set a fallback cookie so the middleware gate clears on the next request
  // even if unstable_update hangs (known issue in self-hosted/Docker environments
  // where the internal HTTP call can deadlock). Cookie value = user ID to
  // prevent cross-user forgery.
  const jar = await cookies()
  jar.set('__dpa_ack', session.user.id, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   30 * 24 * 60 * 60, // 30 days
  })

  // Best-effort JWT patch — fire-and-forget so a hang never blocks the response
  void unstable_update({ dpaAcceptedAt: now.toISOString() } as any)
}
