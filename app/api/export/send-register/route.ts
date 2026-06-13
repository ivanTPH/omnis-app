export const maxDuration = 60

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getSendRegisterData } from '@/app/actions/send-support'
import { generatePdf } from '@/lib/pdf/generator'
import { sendRegisterPdf } from '@/lib/pdf/send-register-template'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await getSendRegisterData()
  const html = sendRegisterPdf(rows, user.schoolName)
  const pdf  = await generatePdf(html)

  const date = new Date().toISOString().slice(0, 10)
  const name = `send-register-${date}.pdf`

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
