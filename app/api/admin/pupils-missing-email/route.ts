import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/accounts/placeholder'

/**
 * GET /api/admin/pupils-missing-email
 * CSV of pupils who have no school email address yet, in the format the
 * "Import students (CSV)" button accepts. The admin fills in the email column
 * and uploads it; matching pupils get their address (no emails are sent).
 */
function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  // Neutralise spreadsheet formulas and quote fields
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export async function GET() {
  const session = await auth()
  const user = session?.user as { schoolId?: string; role?: string } | undefined
  if (!user?.schoolId || !['SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pupils = await prisma.user.findMany({
    where:  { schoolId: user.schoolId, role: 'STUDENT', isActive: true, email: { endsWith: `@${PLACEHOLDER_EMAIL_DOMAIN}` } },
    select: { firstName: true, lastName: true, yearGroup: true, tutorGroup: true },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  })
  const rows = [
    ['firstName', 'lastName', 'yearGroup', 'form', 'email'].join(','),
    ...pupils.map(p => [cell(p.firstName), cell(p.lastName), cell(p.yearGroup), cell(p.tutorGroup), cell('')].join(',')),
  ]
  return new NextResponse(rows.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="pupils-missing-email.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
