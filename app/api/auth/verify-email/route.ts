import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma, writeAudit } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  let token: string
  try {
    const body = await req.json()
    token = body.token
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { id: true, schoolId: true, activatedAt: true } } },
  })

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired or already been used. Use "Forgot password" to get a new one.' },
      { status: 400 },
    )
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { activatedAt: new Date() } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ])

  writeAudit({
    schoolId: record.user.schoolId,
    actorId: record.userId,
    action: 'USER_PROVISIONED',
    targetType: 'User',
    targetId: record.userId,
    metadata: { source: 'email_verification' },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
