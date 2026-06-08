import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendStaffInvitationEmail } from '@/lib/email'
import { ROLE_LABEL } from '@/components/admin/AdminStaffTable'

export async function POST(req: NextRequest) {
  const session = await auth()
  const user = session?.user
  if (!user?.schoolId || !['SCHOOL_ADMIN', 'SLT'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; firstName?: string; lastName?: string; role?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { email, firstName, lastName, role } = body
  if (!email || !firstName || !lastName || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const normalised = email.trim().toLowerCase()

  // Check not already a user in this school
  const existing = await prisma.user.findFirst({ where: { email: normalised, schoolId: user.schoolId } })
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists in your school.' }, { status: 409 })
  }

  // Invalidate any previous pending invites for this email+school
  await prisma.staffInvitation.updateMany({
    where: { email: normalised, schoolId: user.schoolId, used: false },
    data:  { used: true },
  })

  const raw    = crypto.randomBytes(32).toString('hex')
  const hash   = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await prisma.staffInvitation.create({
    data: {
      schoolId:    user.schoolId,
      email:       normalised,
      role,
      firstName,
      lastName,
      tokenHash:   hash,
      expiresAt:   expiry,
      invitedById: user.id,
    },
  })

  const baseUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const acceptUrl = `${baseUrl}/accept-invite?token=${raw}`
  const roleLabel = (ROLE_LABEL as Record<string, string>)[role] ?? role

  await sendStaffInvitationEmail({
    to:         normalised,
    firstName,
    invitedBy:  `${user.firstName} ${user.lastName}`,
    schoolName: user.schoolName,
    role:       roleLabel,
    acceptUrl,
  })

  return NextResponse.json({ ok: true })
}
