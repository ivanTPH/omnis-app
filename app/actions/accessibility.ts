'use server'

import { requireAuth } from '@/lib/session'
import { prisma }  from '@/lib/prisma'
import { unstable_cache, revalidateTag } from 'next/cache'
import { ACCESSIBILITY_DEFAULTS, type AccessibilitySettings } from '@/lib/accessibility'

async function fetchAccessibilitySettings(userId: string): Promise<AccessibilitySettings> {
  const record = await prisma.userAccessibilitySettings.findUnique({ where: { userId } })
  if (!record) return { ...ACCESSIBILITY_DEFAULTS }
  return {
    dyslexiaFont:  record.dyslexiaFont,
    highContrast:  record.highContrast,
    largeText:     record.largeText,
    reducedMotion: record.reducedMotion,
    lineSpacing:   record.lineSpacing,
  }
}

export async function getAccessibilitySettings(userId: string): Promise<AccessibilitySettings> {
  try {
    return await unstable_cache(
      () => fetchAccessibilitySettings(userId),
      [`accessibility-${userId}`],
      { revalidate: 3600, tags: [`accessibility-${userId}`] },
    )()
  } catch (err) {
    console.error('[getAccessibilitySettings] error:', err)
    return { ...ACCESSIBILITY_DEFAULTS }
  }
}

export async function saveAccessibilitySettings(
  _userId: string,  // ignored — always uses the authenticated user's ID
  settings: Partial<AccessibilitySettings>,
): Promise<AccessibilitySettings> {
  // Security: always use session user ID, never trust client-provided userId
  const user = await requireAuth()
  const userId = user.id as string

  const record = await prisma.userAccessibilitySettings.upsert({
    where:  { userId },
    create: { userId, ...ACCESSIBILITY_DEFAULTS, ...settings },
    update: { ...settings },
  })

  revalidateTag(`accessibility-${userId}`, 'default')

  return {
    dyslexiaFont:  record.dyslexiaFont,
    highContrast:  record.highContrast,
    largeText:     record.largeText,
    reducedMotion: record.reducedMotion,
    lineSpacing:   record.lineSpacing,
  }
}
