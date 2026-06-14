import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const yearGroup = sp.get('yearGroup') ? parseInt(sp.get('yearGroup')!, 10) : undefined
  const days = sp.get('days') ? Math.max(1, parseInt(sp.get('days')!, 10)) : undefined

  const since = days ? new Date(Date.now() - days * 86_400_000) : undefined

  // Fetch published homework
  const homework = await prisma.homework.findMany({
    where: {
      schoolId: user.schoolId,
      status:   'PUBLISHED',
      ...(since ? { dueAt: { gte: since } } : {}),
      ...(yearGroup ? { class: { yearGroup } } : {}),
    },
    select: {
      id:       true,
      title:    true,
      type:     true,
      dueAt:    true,
      class:    { select: { name: true, subject: true, yearGroup: true, enrolments: { select: { userId: true } } } },
      submissions: {
        where: { schoolId: user.schoolId },
        select: { teacherScore: true, autoScore: true, status: true },
      },
    },
    orderBy: { dueAt: 'desc' },
  })

  const GCSE_LETTERS = ['', 'F', 'E', 'D', 'C', 'C+', 'B', 'A', 'A*', 'A**'] as const

  const rows = homework.map(hw => {
    const enrolled   = hw.class.enrolments.length
    const submitted  = hw.submissions.length
    const pct        = enrolled > 0 ? Math.round(submitted / enrolled * 100) : 0
    const scores     = hw.submissions
      .map(s => s.teacherScore ?? s.autoScore)
      .filter((s): s is number => s != null)
    const avgRaw     = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null
    const avgGrade   = avgRaw != null
      ? Math.min(9, Math.max(1, Math.round(avgRaw)))
      : null
    const avgGradeLabel = avgGrade != null
      ? `${avgGrade} (${GCSE_LETTERS[avgGrade as keyof typeof GCSE_LETTERS]})`
      : '—'

    return [
      hw.dueAt.toLocaleDateString('en-GB'),
      hw.title,
      hw.class.name,
      hw.class.subject,
      `Year ${hw.class.yearGroup}`,
      hw.type.replace(/_/g, ' ').toLowerCase(),
      enrolled,
      submitted,
      `${pct}%`,
      avgGradeLabel,
    ]
  })

  const header = ['Due Date', 'Title', 'Class', 'Subject', 'Year Group', 'Type', 'Enrolled', 'Submitted', 'Completion', 'Avg Grade']
  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  const suffix = yearGroup ? `-year${yearGroup}` : ''
  const filename = `homework-analytics${suffix}-${date}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
