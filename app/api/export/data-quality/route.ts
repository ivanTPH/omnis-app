import { NextResponse } from 'next/server'
import { requireAuth }   from '@/lib/session'
import { prisma }        from '@/lib/prisma'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where:  { schoolId: user.schoolId, isActive: true },
    select: {
      id:          true,
      firstName:   true,
      lastName:    true,
      email:       true,
      role:        true,
      yearGroup:   true,
      activatedAt: true,
    },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
  })

  type IssueRow = {
    name:   string
    role:   string
    email:  string
    issues: string[]
  }

  const rows: IssueRow[] = []

  for (const u of users) {
    const issues: string[] = []

    // Missing email
    if (!u.email || u.email.trim() === '') {
      issues.push('Missing email')
    }

    // Placeholder/auto-generated email patterns
    if (u.email && (u.email.includes('@placeholder') || u.email.includes('noemail'))) {
      issues.push('Placeholder email')
    }

    // Students: missing year group
    if (u.role === 'STUDENT' && !u.yearGroup) {
      issues.push('Missing year group')
    }

    // Students not yet activated
    if (u.role === 'STUDENT' && !u.activatedAt) {
      issues.push('Not yet activated')
    }

    // Parents not yet activated
    if (u.role === 'PARENT' && !u.activatedAt) {
      issues.push('Not yet activated')
    }

    if (issues.length > 0) {
      rows.push({
        name:   `${u.lastName}, ${u.firstName}`,
        role:   u.role,
        email:  u.email ?? '',
        issues: issues,
      })
    }
  }

  const header = ['Name', 'Role', 'Email', 'Issues']

  const csvRows = rows.map(r => [
    r.name,
    r.role,
    r.email,
    r.issues.join('; '),
  ])

  const csv = [
    header.map(escapeCsv).join(','),
    ...csvRows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="data-quality-${date}.csv"`,
    },
  })
}
