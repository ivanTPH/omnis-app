import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ ok: true }) // always 200 — don't reveal existence

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) return NextResponse.json({ ok: true })

  // Invalidate previous tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data:  { used: true },
  })

  // Create new token (store hash, send raw)
  const raw   = crypto.randomBytes(32).toString('hex')
  const hash  = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: expiry },
  })

  const baseUrl  = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${raw}`

  await sendPasswordResetEmail({ to: email, firstName: user.firstName, resetUrl })

  return NextResponse.json({ ok: true })
}
