import { NextResponse }             from 'next/server'
import { requireAuth }              from '@/lib/session'
import { getSafeguardingLog }       from '@/app/actions/safeguarding'
import { safeguardingLogPdf }       from '@/lib/pdf/safeguarding-log-template'
import { generatePdf }              from '@/lib/pdf/generator'

const ALLOWED = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const log  = await getSafeguardingLog()
  const name = `${user.firstName} ${user.lastName}`
  const html = safeguardingLogPdf(log, user.schoolName, name)
  const pdf  = await generatePdf(html)

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="safeguarding-log-${date}.pdf"`,
    },
  })
}
