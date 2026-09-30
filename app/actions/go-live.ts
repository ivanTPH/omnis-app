'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { getGoLiveStatus, type GoLiveStatus } from '@/lib/go-live'
import { PLACEHOLDER_EMAIL_DOMAIN, isUsableEmail } from '@/lib/accounts/placeholder'
import { createActivationLink } from '@/lib/accounts/activation'
import { sendWelcomeAccountEmail, sendParentRegistrationInviteEmail, sendStaffWelcomeEmail } from '@/lib/email'
import { runBounded } from '@/lib/batch'
import type { Role } from '@prisma/client'
import { AI_AGENTS_FLAG } from '@/lib/ai/agent-schools'

const STAFF = ['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'COVER_MANAGER', 'TEACHER', 'TEACHING_ASSISTANT', 'SENCO']
const ADMIN = ['SCHOOL_ADMIN', 'SLT']

async function requireAdmin() {
  const u = await requireAuth()
  if (!ADMIN.includes(u.role)) throw new Error('Only the school admin or senior leaders can do this.')
  return u
}

async function requireLive(schoolId: string) {
  const status = await getGoLiveStatus(schoolId)
  if (!status.live) throw new Error('Your school needs to complete the go-live checklist before invitations can be sent.')
  return status
}

// ─── Go-live ─────────────────────────────────────────────────────────────────

/** For the staff pop-up. Returns null for pupils, parents and platform staff. */
export async function getMyGoLiveStatus(): Promise<(GoLiveStatus & { canManage: boolean }) | null> {
  const u = await requireAuth()
  if (!STAFF.includes(u.role) || !u.schoolId) return null
  const status = await getGoLiveStatus(u.schoolId)
  return { ...status, canManage: ADMIN.includes(u.role) }
}

export async function getGoLiveChecklist(): Promise<GoLiveStatus> {
  const u = await requireAdmin()
  return getGoLiveStatus(u.schoolId)
}

export async function markSchoolLive(): Promise<void> {
  const u = await requireAdmin()
  const status = await getGoLiveStatus(u.schoolId)
  if (status.goLiveAt) return
  if (!status.readyToGoLive) throw new Error('Some required items are still outstanding.')
  await prisma.school.update({ where: { id: u.schoolId }, data: { goLiveAt: new Date(), goLiveBy: u.id } })
  // Going live switches on the overnight AI for this school. It only analyses
  // pupils whose records have changed, so it costs nothing until real work
  // arrives. A platform admin can still switch it off per school.
  await prisma.schoolFeatureFlag.upsert({
    where:  { schoolId_flag: { schoolId: u.schoolId, flag: AI_AGENTS_FLAG } },
    create: { schoolId: u.schoolId, flag: AI_AGENTS_FLAG, enabled: true, setBy: u.id },
    update: { enabled: true, setAt: new Date(), setBy: u.id },
  })
  await writeAudit({ schoolId: u.schoolId, actorId: u.id, action: 'SCHOOL_WENT_LIVE', targetType: 'school', targetId: u.schoolId })
  revalidatePath('/admin/go-live')
  revalidatePath('/admin/invitations')
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export type YearRow = {
  yearGroup:  number | null
  pupils:     number
  withEmail:  number
  invited:    number
  activated:  number
  parentEmailsOnMis: number
  parentsRegistered: number
}

export type InvitationOverview = {
  staff:              { total: number; withEmail: number; invited: number; activated: number }
  live:               boolean
  parentSignupOpen:   boolean
  familyContactEmail: string | null
  years:              YearRow[]
}

export async function getInvitationOverview(): Promise<InvitationOverview> {
  const u = await requireAdmin()
  const [school, pupils, contacts, parents] = await Promise.all([
    prisma.school.findUnique({ where: { id: u.schoolId }, select: { goLiveAt: true, isDemo: true, parentSignupOpen: true, familyContactEmail: true } }),
    prisma.user.findMany({
      where:  { schoolId: u.schoolId, role: 'STUDENT', isActive: true },
      select: { yearGroup: true, email: true, invitedAt: true, activatedAt: true, wondeId: true },
    }),
    prisma.wondeContact.findMany({
      where:  { schoolId: u.schoolId, parentalResponsibility: true, email: { not: null } },
      select: { email: true, student: { select: { yearGroup: true } } },
    }),
    prisma.user.findMany({
      where:  { schoolId: u.schoolId, role: 'PARENT', isActive: true },
      select: { email: true },
    }),
  ])
  const registered = new Set(parents.map(p => p.email.toLowerCase()))
  const staffUsers = await prisma.user.findMany({
    where:  { schoolId: u.schoolId, isActive: true, role: { in: STAFF as Role[] } },
    select: { email: true, invitedAt: true, activatedAt: true },
  })
  const staff = {
    total:     staffUsers.length,
    withEmail: staffUsers.filter(s => isUsableEmail(s.email)).length,
    invited:   staffUsers.filter(s => s.invitedAt).length,
    activated: staffUsers.filter(s => s.activatedAt).length,
  }

  const rows = new Map<number | null, YearRow>()
  const row = (y: number | null) => {
    if (!rows.has(y)) rows.set(y, { yearGroup: y, pupils: 0, withEmail: 0, invited: 0, activated: 0, parentEmailsOnMis: 0, parentsRegistered: 0 })
    return rows.get(y)!
  }
  for (const p of pupils) {
    const r = row(p.yearGroup)
    r.pupils++
    if (!p.email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)) r.withEmail++
    if (p.invitedAt) r.invited++
    if (p.activatedAt) r.activated++
  }
  const seen = new Map<number | null, Set<string>>()
  for (const c of contacts) {
    const y = c.student.yearGroup
    const e = c.email!.toLowerCase()
    if (!seen.has(y)) seen.set(y, new Set())
    if (seen.get(y)!.has(e)) continue
    seen.get(y)!.add(e)
    const r = row(y)
    r.parentEmailsOnMis++
    if (registered.has(e)) r.parentsRegistered++
  }

  return {
    staff,
    live:               !!school?.goLiveAt || !!school?.isDemo,
    parentSignupOpen:   !!school?.parentSignupOpen,
    familyContactEmail: school?.familyContactEmail ?? null,
    years: [...rows.values()].sort((a, b) => (a.yearGroup ?? 99) - (b.yearGroup ?? 99)),
  }
}

export async function setFamilyContactEmail(email: string): Promise<void> {
  const u = await requireAdmin()
  const e = email.trim().toLowerCase()
  if (e && !isUsableEmail(e)) throw new Error('Please enter a valid email address.')
  await prisma.school.update({ where: { id: u.schoolId }, data: { familyContactEmail: e || null } })
  revalidatePath('/admin/invitations')
  revalidatePath('/admin/go-live')
}

/** Sends set-up emails to pupils in the chosen year groups who have a real email and have not signed in yet. */
export async function sendPupilInvitations(input: { yearGroups: number[]; resend: boolean }): Promise<{ sent: number; failed: number; skippedNoEmail: number }> {
  const u = await requireAdmin()
  await requireLive(u.schoolId)
  if (input.yearGroups.length === 0) throw new Error('Choose at least one year group.')
  const school = await prisma.school.findUnique({ where: { id: u.schoolId }, select: { name: true, familyContactEmail: true } })

  const pupils = await prisma.user.findMany({
    where: {
      schoolId: u.schoolId, role: 'STUDENT', isActive: true, activatedAt: null,
      yearGroup: { in: input.yearGroups },
      ...(input.resend ? {} : { invitedAt: null }),
    },
    select: { id: true, email: true, firstName: true },
  })
  const withEmail = pupils.filter(p => isUsableEmail(p.email))
  let sent = 0, failed = 0
  await runBounded(withEmail, async p => {
    try {
      const url = await createActivationLink(p.id)
      const ok = await sendWelcomeAccountEmail({
        to: p.email, firstName: p.firstName, role: 'student',
        schoolName: school!.name, activateUrl: url, contactEmail: school!.familyContactEmail,
      })
      if (!ok) { failed++; return }
      await prisma.user.update({ where: { id: p.id }, data: { invitedAt: new Date() } })
      sent++
    } catch {
      failed++
    }
  }, 5)

  await writeAudit({
    schoolId: u.schoolId, actorId: u.id, action: 'INVITATIONS_SENT', targetType: 'school', targetId: u.schoolId,
    metadata: { audience: 'pupils', yearGroups: input.yearGroups, sent, failed, skippedNoEmail: pupils.length - withEmail.length },
  })
  revalidatePath('/admin/invitations')
  return { sent, failed, skippedNoEmail: pupils.length - withEmail.length }
}

export async function setParentRegistration(open: boolean): Promise<void> {
  const u = await requireAdmin()
  if (open) await requireLive(u.schoolId)
  await prisma.school.update({ where: { id: u.schoolId }, data: { parentSignupOpen: open } })
  revalidatePath('/admin/invitations')
}

/**
 * Emails parents/carers (with parental responsibility, at the address the MIS
 * holds) an invitation to register. Opens parent registration if it is closed.
 * Parents who already have an account are skipped.
 */
export async function sendParentInvitations(input: { yearGroups: number[] }): Promise<{ sent: number; failed: number }> {
  const u = await requireAdmin()
  await requireLive(u.schoolId)
  if (input.yearGroups.length === 0) throw new Error('Choose at least one year group.')
  const school = await prisma.school.update({
    where: { id: u.schoolId }, data: { parentSignupOpen: true },
    select: { name: true, familyContactEmail: true },
  })
  const [contacts, parents] = await Promise.all([
    prisma.wondeContact.findMany({
      where:  { schoolId: u.schoolId, parentalResponsibility: true, email: { not: null }, student: { yearGroup: { in: input.yearGroups }, isLeaver: false } },
      select: { email: true, firstName: true, lastName: true },
    }),
    prisma.user.findMany({ where: { schoolId: u.schoolId, role: 'PARENT' }, select: { email: true } }),
  ])
  const registered = new Set(parents.map(p => p.email.toLowerCase()))
  const byEmail = new Map<string, { firstName: string; lastName: string }>()
  for (const c of contacts) {
    const e = c.email!.trim().toLowerCase()
    if (!isUsableEmail(e) || registered.has(e) || byEmail.has(e)) continue
    byEmail.set(e, { firstName: c.firstName, lastName: c.lastName })
  }

  let sent = 0, failed = 0
  await runBounded([...byEmail.entries()], async ([to, c]) => {
    const ok = await sendParentRegistrationInviteEmail({
      to, firstName: c.firstName || 'parent or carer', schoolName: school.name, contactEmail: school.familyContactEmail,
    })
    if (ok) sent++; else failed++
  }, 5)

  await writeAudit({
    schoolId: u.schoolId, actorId: u.id, action: 'INVITATIONS_SENT', targetType: 'school', targetId: u.schoolId,
    metadata: { audience: 'parents', yearGroups: input.yearGroups, sent, failed },
  })
  revalidatePath('/admin/invitations')
  return { sent, failed }
}

/**
 * Set-up emails for staff who haven't signed in yet (for example accounts
 * created from the MIS). Allowed before go-live, so staff can prepare.
 */
export async function sendStaffInvitations(input: { resend: boolean }): Promise<{ sent: number; failed: number }> {
  const u = await requireAdmin()
  const school = await prisma.school.findUnique({ where: { id: u.schoolId }, select: { name: true, familyContactEmail: true } })
  const staff = await prisma.user.findMany({
    where: {
      schoolId: u.schoolId, isActive: true, activatedAt: null, role: { in: STAFF as Role[] },
      id: { not: u.id },
      ...(input.resend ? {} : { invitedAt: null }),
    },
    select: { id: true, email: true, firstName: true },
  })
  let sent = 0, failed = 0
  await runBounded(staff.filter(s => isUsableEmail(s.email)), async s => {
    try {
      const url = await createActivationLink(s.id)
      const ok = await sendStaffWelcomeEmail({ to: s.email, firstName: s.firstName, schoolName: school!.name, activateUrl: url, contactEmail: school!.familyContactEmail })
      if (!ok) { failed++; return }
      await prisma.user.update({ where: { id: s.id }, data: { invitedAt: new Date() } })
      sent++
    } catch { failed++ }
  }, 5)
  await writeAudit({
    schoolId: u.schoolId, actorId: u.id, action: 'INVITATIONS_SENT', targetType: 'school', targetId: u.schoolId,
    metadata: { audience: 'staff', sent, failed },
  })
  revalidatePath('/admin/invitations')
  return { sent, failed }
}
