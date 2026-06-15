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
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parents = await prisma.user.findMany({
    where: { schoolId: user.schoolId, role: 'PARENT', isActive: true },
    select: {
      id:          true,
      firstName:   true,
      lastName:    true,
      email:       true,
      activatedAt: true,
      parentChildLinks: {
        select: {
          child: {
            select: { firstName: true, lastName: true, yearGroup: true },
          },
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  // Bulk-fetch message participation and consent for all parents
  const parentIds = parents.map(p => p.id)

  const [messageCounts, consentCounts] = await Promise.all([
    prisma.msgMessage.groupBy({
      by:     ['senderId'],
      where:  { senderId: { in: parentIds } },
      _count: { id: true },
    }),
    prisma.consentRecord.groupBy({
      by:     ['responderId'],
      where:  { responderId: { in: parentIds } },
      _count: { id: true },
    }),
  ])

  const msgMap     = new Map(messageCounts.map(m => [m.senderId, m._count.id]))
  const consentMap = new Map(consentCounts.map(c => [c.responderId, c._count.id]))

  const header = [
    'Parent Name', 'Email', 'Activated',
    'Children', 'Children Year Groups',
    'Messages Sent', 'Consent Records',
  ]

  const rows = parents.map(p => {
    const children     = p.parentChildLinks.map(l => l.child)
    const yearGroups   = [...new Set(children.map(c => c.yearGroup).filter(Boolean))].sort().join(', ')
    return [
      `${p.lastName}, ${p.firstName}`,
      p.email,
      p.activatedAt ? fmtDate(p.activatedAt) : 'Not activated',
      children.length,
      yearGroups || '—',
      msgMap.get(p.id) ?? 0,
      consentMap.get(p.id) ?? 0,
    ]
  })

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="parent-engagement-${date}.csv"`,
    },
  })
}
