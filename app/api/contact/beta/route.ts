import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkContactRateLimit } from '@/lib/kv'

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
      <tr><td style="padding:8px;font-weight:600;color:#374151;">School</td><td style="padding:8px;color:#111827;">${schoolName}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">Contact</td><td style="padding:8px;color:#111827;">${name}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#374151;">Job title</td><td style="padding:8px;color:#111827;">${jobTitle}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">Email</td><td style="padding:8px;color:#111827;"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#374151;">Phone</td><td style="padding:8px;color:#111827;">${phone || '—'}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">School size</td><td style="padding:8px;color:#111827;">${schoolSize}</td></tr>
      ${message ? `<tr><td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">Message</td><td style="padding:8px;color:#111827;">${message}</td></tr>` : ''}
    </table>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">Sent from omnis-app-ten.vercel.app/marketing/beta</p>
  `

  if (resend) {
    try {
      await resend.emails.send({ from: FROM, to: DEST, subject: `Beta application: ${schoolName}`, html })
    } catch (err) {
      console.error('[contact/beta] email send failed:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }
  }
  // In dev (no RESEND_API_KEY) we still return 200 so the form shows success

  return NextResponse.json({ ok: true })
}
