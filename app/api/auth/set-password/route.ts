import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma, writeAudit } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { token, password } = body
  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { id: true, email: true, schoolId: true } } },
  })

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This setup link has expired or already been used. Request a new one via "Forgot your password?".' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, activatedAt: now },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
  ])

  // Fire-and-forget audit log
  writeAudit({
    schoolId: record.user.schoolId,
    actorId:  record.user.id,
    action:   'USER_PROVISIONED',
    targetType: 'User',
    targetId: record.user.id,
    metadata: { source: 'demo_account_setup' },
  }).catch(() => {})

  return NextResponse.json({ ok: true, email: record.user.email })
}
