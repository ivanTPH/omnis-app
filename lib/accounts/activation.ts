import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export const ACTIVATION_DAYS = 7

export function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? 'https://omnis.education'
}

/**
 * Creates a one-time activation link (valid 7 days) for a new account.
 * Any earlier unused links for the same person stop working.
 */
export async function createActivationLink(userId: string): Promise<string> {
  await prisma.passwordResetToken.updateMany({ where: { userId, used: false }, data: { used: true } })
  const raw  = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + ACTIVATION_DAYS * 24 * 60 * 60 * 1000) },
  })
  return `${appBaseUrl()}/reset-password?token=${raw}&welcome=1`
}
