'use server'

import { auth } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

/**
 * ICO Children's Code Standard 4 (Transparency) — a bite-sized, dismissible,
 * one-time data notice for STUDENT accounts. Unlike /accept-dpa and
 * /accept-terms (hard consent gates), this is informational only: it never
 * blocks access, and once dismissed it is never shown again.
 */

export async function getChildNoticeStatus(): Promise<{ acknowledged: boolean }> {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDENT') return { acknowledged: true }

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { childNoticeAckAt: true },
  })
  return { acknowledged: !!user?.childNoticeAckAt }
}

export async function acknowledgeChildNotice(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  if (session.user.role !== 'STUDENT') return

  const now = new Date()
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { childNoticeAckAt: now },
  })

  await writeAudit({
    schoolId:   session.user.schoolId as string,
    actorId:    session.user.id,
    action:     'CHILD_NOTICE_ACKNOWLEDGED',
    targetType: 'User',
    targetId:   session.user.id,
    metadata:   { acknowledgedAt: now.toISOString() },
  })
}
