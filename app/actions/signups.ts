'use server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM        = 'Ivan at Omnis <notifications@omnis.education>'
const REPLY_TO    = 'ivanyardley@me.com'
const SITE_URL    = process.env.NEXTAUTH_URL ?? 'https://omnis.education'

export interface SignupRow {
  id: string
  name: string
  email: string
  schoolName: string
  jobTitle: string
  schoolSize: string
  appliedAt: string
  reviewed: boolean
  // joined from User
  hasAccount: boolean
  role: string | null
  activated: boolean
  dpaAccepted: boolean
  trialEndsAt: string | null
  trialExpired: boolean
}

export interface SignupStats {
  total: number
  withAccount: number
  activated: number
  dpaAccepted: number
  trialActive: number
}

export async function getSignupDashboard(): Promise<{ rows: SignupRow[]; stats: SignupStats }> {
  await requireAuth('PLATFORM_ADMIN')

  // Deduplicate by email — keep latest application per email
  const apps = await prisma.betaApplication.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Get all users whose email matches any application
  const emails = [...new Set(apps.map(a => a.email))]
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, role: true, activatedAt: true, dpaAcceptedAt: true, trialEndsAt: true },
  })
  const userMap = new Map(users.map(u => [u.email, u]))

  // Deduplicate: one row per email (latest application)
  const seen = new Set<string>()
  const rows: SignupRow[] = []
  const now = new Date()

  for (const app of apps) {
    if (seen.has(app.email)) continue
    seen.add(app.email)

    const u = userMap.get(app.email) ?? null
    const trialEndsAt = u?.trialEndsAt ? u.trialEndsAt.toISOString() : null

    rows.push({
      id:          app.id,
      name:        app.name,
      email:       app.email,
      schoolName:  app.schoolName,
      jobTitle:    app.jobTitle,
      schoolSize:  app.schoolSize,
      appliedAt:   app.createdAt.toISOString(),
      reviewed:    app.reviewed,
      hasAccount:  !!u,
      role:        u?.role ?? null,
      activated:   !!u?.activatedAt,
      dpaAccepted: !!u?.dpaAcceptedAt,
      trialEndsAt,
      trialExpired: trialEndsAt ? new Date(trialEndsAt) < now : false,
    })
  }

  const stats: SignupStats = {
    total:       rows.length,
    withAccount: rows.filter(r => r.hasAccount).length,
    activated:   rows.filter(r => r.activated).length,
    dpaAccepted: rows.filter(r => r.dpaAccepted).length,
    trialActive: rows.filter(r => r.hasAccount && !r.trialExpired).length,
  }

  return { rows, stats }
}

export async function markSignupReviewed(id: string): Promise<void> {
  await requireAuth('PLATFORM_ADMIN')
  await prisma.betaApplication.update({ where: { id }, data: { reviewed: true } })
}

/**
 * Send a personal follow-up email to a beta applicant.
 * Subject + body are composed by the platform admin in the UI.
 * Reply-to is set to ivanyardley@me.com so replies land in the right inbox.
 */
export async function sendSignupEmail(params: {
  email:   string
  name:    string
  subject: string
  body:    string
}): Promise<{ ok: boolean; error?: string }> {
  await requireAuth('PLATFORM_ADMIN')

  const { email, name, subject, body } = params

  if (!resend) {
    return { ok: false, error: 'Email not configured (RESEND_API_KEY missing)' }
  }

  // Convert plain-text body to basic HTML (preserve newlines, linkify login URL)
  const bodyHtml = body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(
      /(https:\/\/omnis\.education[^\s<]*)/g,
      '<a href="$1" style="color:#1d4ed8;">$1</a>',
    )

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f766e 100%);padding:20px 32px;border-radius:12px 12px 0 0;">
        <p style="color:#bfdbfe;font-size:11px;margin:0;letter-spacing:0.05em;text-transform:uppercase;">Omnis Education</p>
      </div>
      <div style="background:#f9fafb;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
        <p style="color:#374151;margin:0 0 20px;">Hi ${name.split(' ')[0]},</p>
        <div style="color:#374151;line-height:1.7;">${bodyHtml}</div>
        <p style="color:#9ca3af;font-size:11px;margin:28px 0 0;border-top:1px solid #e5e7eb;padding-top:16px;">
          Omnis Education · <a href="${SITE_URL}" style="color:#9ca3af;">${SITE_URL.replace('https://', '')}</a>
        </p>
      </div>
    </div>
  `

  try {
    await resend.emails.send({
      from:     FROM,
      to:       email,
      replyTo:  REPLY_TO,
      subject,
      html,
    })
    return { ok: true }
  } catch (err) {
    console.error('[sendSignupEmail] failed:', err)
    return { ok: false, error: String(err) }
  }
}
