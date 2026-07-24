'use server'

import { cookies } from 'next/headers'
import { auth, unstable_update } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

/**
 * Records the parent/student Terms & AUP acceptance.
 * @param acceptedConsents - IDs of the consent items the user ticked
 *   Parent:  platform-terms | privacy-notice | outcome-benchmarking (optional)
 *   Student: aup | privacy-notice
 *
 * When a PARENT ticks 'outcome-benchmarking', a ConsentRecord is created for
 * each child linked via ParentChildLink, against the school's
 * 'outcome-benchmarking' ConsentPurpose (if it exists).
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

  // ── Outcome benchmarking opt-in (parents only) ────────────────────────────
  if (
    session.user.role === 'PARENT' &&
    acceptedConsents.includes('outcome-benchmarking')
  ) {
    try {
      // Find the school's outcome-benchmarking ConsentPurpose
      const purpose = await prisma.consentPurpose.findFirst({
        where: { schoolId: session.user.schoolId as string, slug: 'outcome-benchmarking', isActive: true },
        select: { id: true },
      })

      if (purpose) {
        // Find all children linked to this parent
        const links = await prisma.parentChildLink.findMany({
          where:  { parentId: session.user.id },
          select: { childId: true },
        })

        // Create a ConsentRecord for each child if one doesn't already exist
        await Promise.all(links.map(async link => {
          const existing = await prisma.consentRecord.findFirst({
            where: { purposeId: purpose.id, studentId: link.childId, responderId: session.user.id },
          })
          if (!existing) {
            await prisma.consentRecord.create({
              data: {
                purposeId:   purpose.id,
                studentId:   link.childId,  // User.id of child
                responderId: session.user.id,
                decision:    'granted',
                method:      'portal',
              },
            })
          }
        }))
      }
    } catch (err) {
      // Non-fatal — log but don't block the terms acceptance
      console.error('[acceptTerms] outcome-benchmarking consent record failed:', err)
    }
  }

  // Set a fallback cookie so the middleware gate clears even if unstable_update hangs
  const jar = await cookies()
  jar.set('__terms_ack', session.user.id, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   30 * 24 * 60 * 60,
  })

  // Best-effort JWT patch — fire-and-forget
  void unstable_update({ termsAcceptedAt: now.toISOString() } as any)
}
