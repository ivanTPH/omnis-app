'use server'

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

  // Patch JWT so middleware gate clears immediately without re-login
  await unstable_update({ dpaAcceptedAt: now.toISOString() } as any)
}
