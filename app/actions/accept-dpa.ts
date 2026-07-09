'use server'

import { auth, unstable_update } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

/**
 * Records the staff member's DPA acknowledgement in the DB and patches the
 * JWT token in-place via unstable_update so the middleware gate clears
 * without requiring a full re-login.
 */
export async function acceptDpa() {
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
    metadata:   { acceptedAt: now.toISOString() },
  })

  // Patch JWT token so middleware picks up dpaAcceptedAt immediately
  await unstable_update({ user: { dpaAcceptedAt: now.toISOString() } } as any)
}
