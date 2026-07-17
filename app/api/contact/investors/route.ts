import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkContactRateLimit } from '@/lib/kv'
import { prisma } from '@/lib/prisma'
import { upsertHubspotContact } from '@/lib/hubspot'

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

  const { name, organisation, email, message } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const html = `
    <h2>New investor enquiry</h2>
    <table style="border-collapse:collapse;width:100%;">
      <tr><td style="padding:8px;font-weight:600;color:#374151;">Name</td><td style="padding:8px;color:#111827;">${name}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;">Organisation</td><td style="padding:8px;color:#111827;">${organisation || '—'}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#374151;">Email</td><td style="padding:8px;color:#111827;"><a href="mailto:${email}">${email}</a></td></tr>
      ${message ? `<tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">Message</td><td style="padding:8px;color:#111827;">${message}</td></tr>` : ''}
    </table>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">Sent from omnis.education/marketing/investors</p>
  `

  try {
    await prisma.investorInquiry.create({
      data: { name, organisation: organisation || null, email, message: message || null, ip },
    })
  } catch (err) {
    console.error('[contact/investors] db write failed:', err)
  }

  // Fire-and-forget HubSpot CRM logging
  upsertHubspotContact({
    email,
    firstname: name.split(' ')[0],
    lastname: name.split(' ').slice(1).join(' ') || undefined,
    company: organisation || undefined,
    message,
    leadSource: 'investor_inquiry',
  }).catch(err => console.error('[contact/investors] hubspot upsert failed:', err))

  if (resend) {
    try {
      await resend.emails.send({ from: FROM, to: DEST, subject: `Investor enquiry: ${name}${organisation ? ` (${organisation})` : ''}`, html })
    } catch (err) {
      console.error('[contact/investors] email send failed:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
