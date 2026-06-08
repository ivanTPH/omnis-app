import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

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
  let body: { token?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { token, password } = body
  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const hash   = crypto.createHash('sha256').update(token).digest('hex')
  const invite = await prisma.staffInvitation.findUnique({ where: { tokenHash: hash } })

  if (!invite || invite.used || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invitation link has expired or already been used.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Check if user already exists (edge case: invited twice with different roles)
  const existing = await prisma.user.findFirst({ where: { email: invite.email, schoolId: invite.schoolId } })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    if (!existing) {
      await tx.user.create({
        data: {
          email:        invite.email,
          firstName:    invite.firstName,
          lastName:     invite.lastName,
          role:         invite.role as never,
          passwordHash,
          schoolId:     invite.schoolId,
        },
      })
    } else {
      await tx.user.update({ where: { id: existing.id }, data: { passwordHash } })
    }
    await tx.staffInvitation.update({ where: { id: invite.id }, data: { used: true } })
  })

  return NextResponse.json({ ok: true })
}
