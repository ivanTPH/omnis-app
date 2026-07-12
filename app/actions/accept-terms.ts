'use server'

import { auth, unstable_update } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

/**
 * Records the parent/student Terms & AUP acceptance.
 * @param acceptedConsents - IDs of the consent items the user ticked
 *   Parent:  platform-terms | privacy-notice
 *   Student: aup | privacy-notice
 */
export async function acceptTerms(acceptedConsents: string[] = []) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const now = new Date()
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { termsAcceptedAt: now },
  })

  await writeAudit({
    schoolId:   session.user.schoolId as string,
    actorId:    session.user.id,
    action:     'TERMS_ACCEPTED',
    targetType: 'User',
    targetId:   session.user.id,
    metadata:   {
      acceptedAt:       now.toISOString(),
      role:             session.user.role,
      acceptedConsents,
      consentVersion:   '2026-07',
    },
  })

  // Patch JWT so middleware gate clears immediately without re-login
  await unstable_update({ termsAcceptedAt: now.toISOString() } as any)
}
