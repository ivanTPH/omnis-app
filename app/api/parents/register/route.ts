import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma, writeAudit } from '@/lib/prisma'
import { checkPasswordResetRateLimit, getClientIp } from '@/lib/kv'
import { isUsableEmail } from '@/lib/accounts/placeholder'
import { linkParentToChildren } from '@/lib/accounts/parent-links'
import { createActivationLink } from '@/lib/accounts/activation'
import { sendWelcomeAccountEmail } from '@/lib/email'

/**
 * Parent/carer self-registration (public).
 *
 * A parent types their own email. An account is created only if that email
 * belongs to a contact with parental responsibility on the MIS record of a
 * pupil at a school that is live and has opened parent registration. The
 * response is always the same, so the form cannot be used to find out
 * whether an address is on a school's records.
 */
export async function POST(req: NextRequest) {
  const generic = NextResponse.json({ ok: true })

  const ip = getClientIp(req.headers)
  const { success } = await checkPasswordResetRateLimit(`parent-register:${ip}`)
  if (!success) return generic

  let body: { email?: string }
  try { body = await req.json() } catch { return generic }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!isUsableEmail(email)) return generic

  try {
    const contact = await prisma.wondeContact.findFirst({
      where: {
        parentalResponsibility: true,
        email: { equals: email, mode: 'insensitive' },
        student: { isLeaver: false },
        school: { parentSignupOpen: true, OR: [{ goLiveAt: { not: null } }, { isDemo: true }] },
      },
      select: { schoolId: true, firstName: true, lastName: true, school: { select: { name: true, familyContactEmail: true } } },
    })
    if (!contact) return generic

    let user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, schoolId: true, activatedAt: true, firstName: true } })
    if (user && (user.role !== 'PARENT' || user.schoolId !== contact.schoolId)) return generic // address already used for another account

    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
      user = await prisma.user.create({
        data: {
          email, role: 'PARENT', passwordHash, schoolId: contact.schoolId,
          firstName: contact.firstName || 'Parent', lastName: contact.lastName || '',
        },
        select: { id: true, role: true, schoolId: true, activatedAt: true, firstName: true },
      })
      await writeAudit({
        schoolId: contact.schoolId, actorId: user.id, action: 'PARENT_SELF_REGISTERED',
        targetType: 'user', targetId: user.id, metadata: { source: 'parent-registration' },
      })
    }

    await linkParentToChildren(contact.schoolId, user.id, email)
    const childCount = await prisma.parentChildLink.count({ where: { parentId: user.id } })
    if (childCount === 0) return generic // children not yet in Omnis — nothing to show them

    if (!user.activatedAt) {
      const activateUrl = await createActivationLink(user.id)
      await sendWelcomeAccountEmail({
        to: email, firstName: user.firstName, role: 'parent',
        schoolName: contact.school.name, activateUrl, contactEmail: contact.school.familyContactEmail,
      })
      await prisma.user.update({ where: { id: user.id }, data: { invitedAt: new Date() } })
    }
  } catch (err) {
    console.error('[parents/register] failed', err)
  }
  return generic
}
