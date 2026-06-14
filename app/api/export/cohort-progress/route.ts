import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']

const GCSE_LETTERS = ['', 'F', 'E', 'D', 'C', 'C+', 'B', 'A', 'A*', 'A**'] as const

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function gradeLabel(score: number | null): string {
  if (score == null) return '—'
  const g = Math.min(9, Math.max(1, Math.round(score))) as 1|2|3|4|5|6|7|8|9
  return `${g} (${GCSE_LETTERS[g]})`
}

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const yearGroup = sp.get('yearGroup') ? parseInt(sp.get('yearGroup')!, 10) : undefined

  // Fetch all active students
  const students = await prisma.user.findMany({
    where: {
      schoolId:  user.schoolId,
      role:      'STUDENT',
      isActive:  true,
      ...(yearGroup ? { yearGroup } : {}),
    },
    select: {
      id:                    true,
      firstName:             true,
      lastName:              true,
      yearGroup:             true,
      tutorGroup:             true,
      attendancePercentage:  true,
      sendStatus:            { select: { activeStatus: true } },
      enrolments: {
        select: {
          class: {
            select: {
              performanceAggregates: {
                orderBy: { id: 'desc' },
                take:    1,
                select:  { avgScore: true },
              },
            },
          },
        },
      },
      submissions: {
        where:  { schoolId: user.schoolId },
        select: { status: true },
      },
    },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })

  const rows = students.map(s => {
    // Average grade across their class performance aggregates
    const aggScores = s.enrolments
      .flatMap(e => e.class.performanceAggregates)
      .map(a => a.avgScore)
      .filter((v): v is number => v != null)
    const avgGrade = aggScores.length > 0
      ? aggScores.reduce((a, b) => a + b, 0) / aggScores.length
      : null

    const total     = s.submissions.length
    const completed = s.submissions.filter(sub =>
      ['MARKED', 'RETURNED', 'UNDER_REVIEW'].includes(sub.status)
    ).length
    const hwPct = total > 0 ? Math.round(completed / total * 100) : null

    const sendStatus = s.sendStatus?.activeStatus ?? 'NONE'

    return [
      `${s.lastName}, ${s.firstName}`,
      s.yearGroup ?? '—',
      s.tutorGroup ?? '—',
      sendStatus === 'NONE' ? '' : sendStatus,
      s.attendancePercentage != null ? `${s.attendancePercentage}%` : '—',
      gradeLabel(avgGrade),
      hwPct != null ? `${hwPct}%` : '—',
    ]
  })

  const header = ['Student', 'Year', 'Tutor Group', 'SEND Status', 'Attendance', 'Avg Grade', 'HW Completion']
  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  const suffix = yearGroup ? `-year${yearGroup}` : ''
  const filename = `cohort-progress${suffix}-${date}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
