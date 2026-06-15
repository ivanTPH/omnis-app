import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { concernsReportPdf } from '@/lib/pdf/concerns-report-template'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const concerns = await prisma.sendConcern.findMany({
    where: {
      schoolId: user.schoolId,
      status:   { in: ['open', 'under_review', 'escalated'] },
    },
    select: {
      status:   true,
      category: true,
      student:  { select: { yearGroup: true } },
    },
  })

  // Group by year group
  type YgData = {
    open: number
    underReview: number
    escalated: number
    cats: Map<string, number>
  }
  const ygMap = new Map<number | null, YgData>()

  for (const c of concerns) {
    const yg = c.student.yearGroup ?? null
    if (!ygMap.has(yg)) ygMap.set(yg, { open: 0, underReview: 0, escalated: 0, cats: new Map() })
    const entry = ygMap.get(yg)!
    if (c.status === 'open')         entry.open++
    else if (c.status === 'under_review') entry.underReview++
    else if (c.status === 'escalated')    entry.escalated++
    entry.cats.set(c.category, (entry.cats.get(c.category) ?? 0) + 1)
  }

  const yearGroups = [...ygMap.entries()]
    .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
    .map(([yearGroup, data]) => ({
      yearGroup,
      open:        data.open,
      underReview: data.underReview,
      escalated:   data.escalated,
      categories:  [...data.cats.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
    }))

  const totalOpen      = yearGroups.reduce((s, y) => s + y.open, 0)
  const totalReview    = yearGroups.reduce((s, y) => s + y.underReview, 0)
  const totalEscalated = yearGroups.reduce((s, y) => s + y.escalated, 0)

  const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })

  const html = concernsReportPdf({
    schoolName:     school?.name ?? user.schoolName,
    generatedAt:    new Date(),
    totalOpen,
    totalReview,
    totalEscalated,
    yearGroups,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="concerns-report-${date}.pdf"`,
    },
  })
}
