import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkContactRateLimit } from '@/lib/kv'
import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'
import { upsertHubspotContact } from '@/lib/hubspot'
import { sendBetaWelcomeEmail } from '@/lib/email'

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://omnis.education'

function mapJobTitleToRole(jobTitle: string): Role {
  if (['Headteacher / Principal', 'Deputy Headteacher', 'SLT member'].includes(jobTitle)) return 'SLT'
  if (jobTitle === 'SENCO') return 'SENCO'
  if (jobTitle === 'Head of Department') return 'HEAD_OF_DEPT'
  if (jobTitle === 'Head of Year') return 'HEAD_OF_YEAR'
  if (['IT / Systems Manager', 'School Business Manager'].includes(jobTitle)) return 'SCHOOL_ADMIN'
  return 'TEACHER'
}

const ROLE_LABELS: Record<string, string> = {
  SLT: 'Senior Leadership (SLT)', SENCO: 'SENCO', HEAD_OF_DEPT: 'Head of Department',
  HEAD_OF_YEAR: 'Head of Year', SCHOOL_ADMIN: 'School Administrator', TEACHER: 'Teacher',
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const DEST   = 'ivanyardley@me.com'
const FROM   = 'Omnis Website <notifications@omnis.education>'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success } = await checkContactRateLimit(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests — please try again later' }, { status: 429 })

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { schoolName, name, jobTitle, email, phone, schoolSize, message } = body

  if (!schoolName || !name || !jobTitle || !email || !schoolSize) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const html = `
    <h2>New beta access application</h2>
    <table style="border-collapse:collapse;width:100%;">
      <tr><td style="padding:8px;font-weight:600;color:#374151;">School</td><td style="padding:8px;color:#111827;">${h(schoolName)}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">Contact</td><td style="padding:8px;color:#111827;">${h(name)}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#374151;">Job title</td><td style="padding:8px;color:#111827;">${h(jobTitle)}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">Email</td><td style="padding:8px;color:#111827;"><a href="mailto:${h(email)}">${h(email)}</a></td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#374151;">Phone</td><td style="padding:8px;color:#111827;">${phone ? h(phone) : '—'}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">School size</td><td style="padding:8px;color:#111827;">${h(schoolSize)}</td></tr>
      ${message ? `<tr><td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">Message</td><td style="padding:8px;color:#111827;">${h(message)}</td></tr>` : ''}
    </table>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">Sent from omnis.education/marketing/beta</p>
  `

  // Persist first — a lost/delayed email should never mean the application is gone.
  try {
    await prisma.betaApplication.create({
      data: { schoolName, name, jobTitle, email, phone: phone || null, schoolSize, message: message || null, ip },
    })
  } catch (err) {
    console.error('[contact/beta] db write failed:', err)
  }

  // Fire-and-forget HubSpot CRM logging
  upsertHubspotContact({
    email,
    firstname: name.split(' ')[0],
    lastname: name.split(' ').slice(1).join(' ') || undefined,
    company: schoolName,
    phone: phone || undefined,
    message,
    leadSource: 'beta_application',
  }).catch(err => console.error('[contact/beta] hubspot upsert failed:', err))

  // ── Create demo account ───────────────────────────────────────────────────
  // Provision the applicant a demo account on the Omnis demo school so they
  // can explore the platform immediately. Falls back gracefully if the demo
  // school hasn't been seeded in this environment.
  let demoCreated = false
  let roleLabel = ''
  try {
    const demoSchool = await prisma.school.findFirst({
      where: { OR: [{ name: 'Omnis Demo School' }, { emailDomain: 'omnisdemo.school' }] },
      select: { id: true },
    })
    if (demoSchool) {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (!existing) {
        const role   = mapJobTitleToRole(jobTitle)
        roleLabel    = ROLE_LABELS[role] ?? 'Teacher'
        const [firstName, ...rest] = name.trim().split(' ')
        // Create user with a random unusable placeholder hash — they must set their real
        // password via the set-password link. bcrypt of 32 random bytes is effectively unguessable.
        const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
        const newUser = await prisma.user.create({
          data: {
            email,
            passwordHash: placeholderHash,
            firstName,
            lastName: rest.join(' ') || firstName,
            role,
            schoolId: demoSchool.id,
            isActive: true,
          },
          select: { id: true, firstName: true },
        })
        // Generate single-use setup token valid for 24 hours
        const rawToken = crypto.randomBytes(32).toString('hex')
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
        await prisma.passwordResetToken.create({
          data: {
            userId:    newUser.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })
        const setPasswordUrl = `${SITE_URL}/set-password?token=${rawToken}`
        demoCreated = true
        // Send welcome email with setup link (fire-and-forget — never block the response)
        sendBetaWelcomeEmail({ to: email, firstName: newUser.firstName, email, roleLabel, setPasswordUrl })
          .catch(err => console.error('[contact/beta] welcome email failed:', err))
      }
    }
  } catch (err) {
    console.error('[contact/beta] demo account creation failed:', err)
  }

  // Notify ivan — update the email html to include demo account status
  const demoLine = demoCreated
    ? `<tr style="background:#f0fdf4;"><td style="padding:8px;font-weight:600;color:#166534;">Demo account</td><td style="padding:8px;color:#166534;">✓ Created — ${h(email)} / ${h(roleLabel)}</td></tr>`
    : `<tr style="background:#fef9c3;"><td style="padding:8px;font-weight:600;color:#854d0e;">Demo account</td><td style="padding:8px;color:#854d0e;">Not created (demo school not found or email already exists)</td></tr>`
  const enrichedHtml = html.replace('</table>', `${demoLine}</table>`)

  if (resend) {
    try {
      await resend.emails.send({ from: FROM, to: DEST, subject: `Beta application: ${schoolName}`, html: enrichedHtml })
    } catch (err) {
      console.error('[contact/beta] email send failed:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }
  }
  // In dev (no RESEND_API_KEY) we still return 200 so the form shows success

  return NextResponse.json({ ok: true, demoCreated })
}
