'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { mfaInfraAvailable, storeMfaCode, checkMfaRequestRateLimit } from '@/lib/kv'
import { sendMfaCodeEmail } from '@/lib/email'
import { STAFF_ROLES } from '@/lib/roles'

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)) // 6 digits, zero-padded by construction
}

export type MfaRequestResult =
  | { status: 'not_required' }   // proceed straight to normal sign-in (wrong creds, non-staff role, or MFA infra unavailable)
  | { status: 'code_sent' }
  | { status: 'rate_limited'; message: string }

/**
 * Called by the login page BEFORE next-auth's signIn(). Verifies the
 * password itself (read-only — does not create a session) purely to decide
 * whether a code needs emailing. The real authentication decision still
 * happens in lib/auth.ts's authorize(), which re-verifies both the password
 * and the code independently — this action is a UX helper, not a security
 * boundary on its own.
 */
/** Domain suffixes that are demo/test environments — MFA not required. */
const DEMO_DOMAINS = ['@omnisdemo.school', '@students.omnisdemo.school', '@parents.omnisdemo.school']
function isDemoAccount(email: string): boolean {
  return DEMO_DOMAINS.some(d => email.endsWith(d))
}

export async function requestLoginMfaCode(email: string, password: string): Promise<MfaRequestResult> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return { status: 'not_required' }
  if (!(await bcrypt.compare(password, user.passwordHash))) return { status: 'not_required' }
  if (!(STAFF_ROLES as readonly string[]).includes(user.role)) return { status: 'not_required' }
  if (!mfaInfraAvailable()) return { status: 'not_required' } // dev/CI without Upstash configured — graceful no-op
  if (isDemoAccount(email)) return { status: 'not_required' } // demo accounts have public credentials; MFA adds no security

  const { success } = await checkMfaRequestRateLimit(user.id)
  if (!success) {
    return { status: 'rate_limited', message: 'Too many code requests. Wait a few minutes and try again.' }
  }

  const code = generateCode()
  await storeMfaCode(user.id, code)
  await sendMfaCodeEmail({ to: user.email, firstName: user.firstName, code })

  return { status: 'code_sent' }
}
