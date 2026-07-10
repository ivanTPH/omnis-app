'use server'

import { auth, unstable_update } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

/**
 * Records the parent/student Terms & AUP acceptance in the DB and patches
 * the JWT token in-place so the middleware gate clears without re-login.
 */
export async function acceptTerms() {
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
    metadata:   { acceptedAt: now.toISOString(), role: session.user.role },
  })

  // Patch JWT so middleware gate clears immediately (no re-login required)
  await unstable_update({ termsAcceptedAt: now.toISOString() } as any)
}
