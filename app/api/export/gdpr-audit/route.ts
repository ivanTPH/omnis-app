import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all consent purposes for this school
  const purposes = await prisma.consentPurpose.findMany({
    where: { schoolId: user.schoolId },
    select: {
      id:          true,
      slug:        true,
      title:       true,
      lawfulBasis: true,
      records: {
        select: {
          id:          true,
          studentId:   true,
          responderId: true,
          decision:    true,
          method:      true,
          notes:       true,
          recordedAt:  true,
          expiresAt:   true,
        },
        orderBy: { recordedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Collect all unique studentIds and responderIds for name lookups
  const studentIds  = new Set<string>()
  const responderIds = new Set<string>()
  for (const p of purposes) {
    for (const r of p.records) {
      studentIds.add(r.studentId)
      responderIds.add(r.responderId)
    }
  }

  // Look up Wonde students (consent uses WondeStudent.id)
  const wondeStudents = await prisma.wondeStudent.findMany({
    where: { id: { in: [...studentIds] } },
    select: { id: true, firstName: true, lastName: true },
  })
  const studentMap = new Map(wondeStudents.map(s => [s.id, `${s.firstName} ${s.lastName}`]))

  // Look up responders (Users)
  const responders = await prisma.user.findMany({
    where: { id: { in: [...responderIds] } },
    select: { id: true, firstName: true, lastName: true },
  })
  const responderMap = new Map(responders.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

  const header = [
    'Purpose', 'Slug', 'Lawful Basis',
    'Student', 'Responder', 'Decision', 'Method',
    'Recorded At', 'Expires At', 'Notes',
  ]

  const rows: string[][] = []
  for (const p of purposes) {
    for (const r of p.records) {
      rows.push([
        p.title,
        p.slug,
        p.lawfulBasis,
        studentMap.get(r.studentId) ?? r.studentId,
        responderMap.get(r.responderId) ?? r.responderId,
        r.decision,
        r.method,
        fmtDate(r.recordedAt),
        fmtDate(r.expiresAt),
        r.notes ?? '',
      ])
    }
  }

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gdpr-consent-audit-${date}.csv"`,
    },
  })
}
