'use server'

import { auth }    from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma }  from '@/lib/prisma'
import { ACCESSIBILITY_DEFAULTS, type AccessibilitySettings } from '@/lib/accessibility'

async function requireAuth() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return session.user as any
}

export async function getAccessibilitySettings(userId: string): Promise<AccessibilitySettings> {
  const record = await prisma.userAccessibilitySettings.findUnique({
    where: { userId },
  })
  if (!record) return { ...ACCESSIBILITY_DEFAULTS }
  return {
    dyslexiaFont:  record.dyslexiaFont,
    highContrast:  record.highContrast,
    largeText:     record.largeText,
    reducedMotion: record.reducedMotion,
    lineSpacing:   record.lineSpacing,
  }
}

export async function saveAccessibilitySettings(
  userId: string,
  settings: Partial<AccessibilitySettings>,
): Promise<AccessibilitySettings> {
  await requireAuth()

  const record = await prisma.userAccessibilitySettings.upsert({
    where:  { userId },
    create: { userId, ...ACCESSIBILITY_DEFAULTS, ...settings },
    update: { ...settings },
  })

  return {
    dyslexiaFont:  record.dyslexiaFont,
    highContrast:  record.highContrast,
    largeText:     record.largeText,
    reducedMotion: record.reducedMotion,
    lineSpacing:   record.lineSpacing,
  }
}
