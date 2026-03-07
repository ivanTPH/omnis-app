'use server'

import { auth }                from '@/lib/auth'
import { prisma, writeAudit }  from '@/lib/prisma'
import { revalidatePath }      from 'next/cache'
import bcrypt                  from 'bcryptjs'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingsUser = {
  id:         string
  firstName:  string
  lastName:   string
  email:      string
  role:       string
  department: string | null
  school:     { name: string }
}

export type SettingsData = {
  id:                         string
  phone:                      string | null
  profilePictureUrl:          string | null
  bio:                        string | null
  defaultSubject:             string | null
  allowEmailNotifications:    boolean
  allowSmsNotifications:      boolean
  allowAnalyticsInsights:     boolean
  profileVisibleToColleagues: boolean
  profileVisibleToAdmins:     boolean
  lessonSharing:              'SCHOOL' | 'SELECTED' | 'PRIVATE'
  allowAiImprovement:         boolean
  pendingEmail:               string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSession() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthenticated')
  const user = session.user as any
  return { userId: user.id as string, schoolId: user.schoolId as string }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Fetch (or create default) UserSettings for the current user. */
export async function getMySettings(): Promise<SettingsData> {
  const { userId } = await getSession()
  return prisma.userSettings.upsert({
    where:  { userId },
    create: { userId },
    update: {},
  }) as Promise<SettingsData>
}

/** Save profile identity fields + write per-field audit entries. */
export async function saveProfile(input: {
  firstName: string
  lastName:  string
  phone:     string
  bio:       string
}): Promise<{ ok: true }> {
  const { userId, schoolId } = await getSession()

  // Validate required fields
  if (!input.firstName.trim()) throw new Error('First name is required.')
  if (!input.lastName.trim())  throw new Error('Last name is required.')

  // Validate phone format (allow empty)
  if (input.phone && !/^\+?[0-9\s\-(). ]{7,20}$/.test(input.phone.trim())) {
    throw new Error('Invalid telephone format. Use international format, e.g. +44 7700 900123.')
  }

  // Fetch current values for audit diff
  const [currentUser, currentSettings] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.userSettings.findUnique({
      where:  { userId },
      select: { phone: true, bio: true },
    }),
  ])

  // Update User record
  await prisma.user.update({
    where: { id: userId },
    data:  { firstName: input.firstName.trim(), lastName: input.lastName.trim() },
  })

  // Upsert UserSettings record
  await prisma.userSettings.upsert({
    where:  { userId },
    create: { userId, phone: input.phone.trim() || null, bio: input.bio.trim() || null },
    update: { phone: input.phone.trim() || null, bio: input.bio.trim() || null },
  })

  // Audit each changed field
  const diffs: [string, string | null, string | null][] = [
    ['firstName', currentUser?.firstName ?? null, input.firstName.trim()],
    ['lastName',  currentUser?.lastName  ?? null, input.lastName.trim()],
    ['phone',     currentSettings?.phone ?? null, input.phone.trim() || null],
    ['bio',       currentSettings?.bio   ?? null, input.bio.trim()   || null],
  ]
  for (const [field, from, to] of diffs) {
    if (from !== to) {
      await writeAudit({
        schoolId,
        actorId:    userId,
        action:     'USER_SETTINGS_CHANGED',
        targetType: 'User',
        targetId:   userId,
        metadata:   { field, from, to },
      })
    }
  }

  revalidatePath('/settings')
  return { ok: true }
}

/** Request an email change — stores in pendingEmail; does NOT update User.email. */
export async function requestEmailChange(
  newEmail: string,
): Promise<{ status: 'pending_verification' }> {
  const { userId, schoolId } = await getSession()

  const email = newEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address.')
  }

  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing && existing.id !== userId) {
    throw new Error('That email address is already in use.')
  }

  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

  await prisma.userSettings.upsert({
    where:  { userId },
    create: { userId, pendingEmail: email },
    update: { pendingEmail: email },
  })

  await writeAudit({
    schoolId,
    actorId:    userId,
    action:     'USER_SETTINGS_CHANGED',
    targetType: 'User',
    targetId:   userId,
    metadata:   { field: 'email_change_requested', from: currentUser?.email ?? null, to: email },
  })

  revalidatePath('/settings')
  return { status: 'pending_verification' }
}

/** Save professional preferences (default subject). */
export async function saveProfessionalPrefs(input: {
  defaultSubject: string
}): Promise<{ ok: true }> {
  const { userId, schoolId } = await getSession()

  const current = await prisma.userSettings.findUnique({
    where:  { userId },
    select: { defaultSubject: true },
  })

  const newSubject = input.defaultSubject || null

  await prisma.userSettings.upsert({
    where:  { userId },
    create: { userId, defaultSubject: newSubject },
    update: { defaultSubject: newSubject },
  })

  if ((current?.defaultSubject ?? null) !== newSubject) {
    await writeAudit({
      schoolId,
      actorId:    userId,
      action:     'USER_SETTINGS_CHANGED',
      targetType: 'User',
      targetId:   userId,
      metadata:   { field: 'defaultSubject', from: current?.defaultSubject ?? null, to: newSubject },
    })
  }

  revalidatePath('/settings')
  return { ok: true }
}

/** Save privacy & notification toggles. */
export async function savePrivacySettings(input: {
  allowEmailNotifications:    boolean
  allowSmsNotifications:      boolean
  allowAnalyticsInsights:     boolean
  profileVisibleToColleagues: boolean
  profileVisibleToAdmins:     boolean
}): Promise<{ ok: true }> {
  const { userId, schoolId } = await getSession()

  const current = await prisma.userSettings.findUnique({ where: { userId } })

  await prisma.userSettings.upsert({
    where:  { userId },
    create: { userId, ...input },
    update: input,
  })

  // Audit each changed boolean
  const fields = [
    'allowEmailNotifications',
    'allowSmsNotifications',
    'allowAnalyticsInsights',
    'profileVisibleToColleagues',
    'profileVisibleToAdmins',
  ] as const
  for (const field of fields) {
    const oldVal = current ? current[field] : null
    const newVal = input[field]
    if (oldVal !== newVal) {
      await writeAudit({
        schoolId,
        actorId:    userId,
        action:     'USER_SETTINGS_CHANGED',
        targetType: 'User',
        targetId:   userId,
        metadata:   { field, from: oldVal, to: newVal },
      })
    }
  }

  revalidatePath('/settings')
  return { ok: true }
}

/** Save lesson sharing & AI opt-in settings. */
export async function saveSharingSettings(input: {
  lessonSharing:      'SCHOOL' | 'SELECTED' | 'PRIVATE'
  allowAiImprovement: boolean
}): Promise<{ ok: true }> {
  const { userId, schoolId } = await getSession()

  const current = await prisma.userSettings.findUnique({ where: { userId } })

  await prisma.userSettings.upsert({
    where:  { userId },
    create: { userId, ...input },
    update: input,
  })

  if ((current?.lessonSharing ?? 'PRIVATE') !== input.lessonSharing) {
    await writeAudit({
      schoolId, actorId: userId, action: 'USER_SETTINGS_CHANGED', targetType: 'User', targetId: userId,
      metadata: { field: 'lessonSharing', from: current?.lessonSharing ?? 'PRIVATE', to: input.lessonSharing },
    })
  }
  if ((current?.allowAiImprovement ?? false) !== input.allowAiImprovement) {
    await writeAudit({
      schoolId, actorId: userId, action: 'USER_SETTINGS_CHANGED', targetType: 'User', targetId: userId,
      metadata: { field: 'allowAiImprovement', from: current?.allowAiImprovement ?? false, to: input.allowAiImprovement },
    })
  }

  revalidatePath('/settings')
  return { ok: true }
}

/** Change the user's password after verifying the current one. */
export async function changePassword(input: {
  currentPassword: string
  newPassword:     string
  confirmPassword: string
}): Promise<{ ok: true }> {
  const { userId, schoolId } = await getSession()

  if (input.newPassword !== input.confirmPassword) {
    throw new Error('Passwords do not match.')
  }
  if (input.newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  if (!/[a-zA-Z]/.test(input.newPassword) || !/[0-9]/.test(input.newPassword)) {
    throw new Error('Password must include at least one letter and one number.')
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { passwordHash: true },
  })
  if (!user) throw new Error('User not found.')

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash)
  if (!valid) throw new Error('Incorrect current password.')

  const newHash = await bcrypt.hash(input.newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } })

  await writeAudit({
    schoolId, actorId: userId, action: 'USER_SETTINGS_CHANGED', targetType: 'User', targetId: userId,
    metadata: { field: 'password', from: '[redacted]', to: '[redacted]' },
  })

  return { ok: true }
}
