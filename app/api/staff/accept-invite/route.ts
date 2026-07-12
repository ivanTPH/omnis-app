import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma, writeAudit } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const hash  = crypto.createHash('sha256').update(token).digest('hex')
  const invite = await prisma.staffInvitation.findUnique({
    where: { tokenHash: hash },
    select: { used: true, expiresAt: true, email: true, firstName: true, lastName: true, role: true },
  })
  if (!invite || invite.used || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invitation link has expired or already been used.' }, { status: 400 })
  }
  return NextResponse.json({
    email:     invite.email,
    firstName: invite.firstName,
    lastName:  invite.lastName,
    role:      invite.role,
  })
}

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string; acceptedConsents?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { token, password, acceptedConsents = [] } = body
  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const hash   = crypto.createHash('sha256').update(token).digest('hex')
  const invite = await prisma.staffInvitation.findUnique({ where: { tokenHash: hash } })

  if (!invite || invite.used || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invitation link has expired or already been used.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const now          = new Date()

  // Check if user already exists (edge case: invited twice with different roles)
  const existing = await prisma.user.findFirst({ where: { email: invite.email, schoolId: invite.schoolId } })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userId: string = existing?.id ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    if (!existing) {
      const created = await tx.user.create({
        data: {
          email:          invite.email,
          firstName:      invite.firstName,
          lastName:       invite.lastName,
          role:           invite.role as never,
          passwordHash,
          schoolId:       invite.schoolId,
          // Consent captured inline at account creation — no post-login DPA gate required
          dpaAcceptedAt:  acceptedConsents.length > 0 ? now : null,
          termsAcceptedAt: null,
        },
      })
      userId = created.id
    } else {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          // Only set dpaAcceptedAt if not already accepted and consents were provided
          ...(acceptedConsents.length > 0 && !existing.dpaAcceptedAt
            ? { dpaAcceptedAt: now }
            : {}),
        },
      })
      userId = existing.id
    }
    await tx.staffInvitation.update({ where: { id: invite.id }, data: { used: true } })
  })

  // Audit log the DPA acceptance — fire and forget (user row already committed)
  if (acceptedConsents.length > 0 && userId) {
    void writeAudit({
      schoolId:   invite.schoolId,
      actorId:    userId,
      action:     'DPA_ACCEPTED',
      targetType: 'User',
      targetId:   userId,
      metadata:   {
        acceptedAt:       now.toISOString(),
        acceptedConsents,
        consentVersion:   '2026-07',
        source:           'staff-invite',
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
