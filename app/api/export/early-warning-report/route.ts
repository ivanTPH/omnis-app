import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { earlyWarningReportPdf } from '@/lib/pdf/early-warning-template'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const flags = await prisma.earlyWarningFlag.findMany({
    where:   { schoolId: user.schoolId, expiresAt: { gte: new Date() } },
    orderBy: [{ isActioned: 'asc' }, { severity: 'asc' }, { createdAt: 'desc' }],
  })

  // Resolve student names
  const studentIds = [...new Set(flags.map(f => f.studentId))]
  const students   = studentIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, yearGroup: true },
      })
    : []
  const studentMap = new Map(students.map(s => [s.id, s]))

  // Resolve actioned-by names
  const actionerIds = [...new Set(flags.map(f => f.actionedBy).filter(Boolean) as string[])]
  const actionerUsers = actionerIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: actionerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const actionerMap = new Map(actionerUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

  const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })

  const flagRows = flags.map(f => {
    const st = studentMap.get(f.studentId)
    return {
      studentName:    st ? `${st.firstName} ${st.lastName}` : '—',
      yearGroup:      st?.yearGroup ?? null,
      flagType:       f.flagType,
      severity:       f.severity,
      description:    f.description,
      createdAt:      f.createdAt,
      expiresAt:      f.expiresAt,
      isActioned:     f.isActioned,
      actionType:     f.actionType,
      actionedByName: f.actionedBy ? (actionerMap.get(f.actionedBy) ?? null) : null,
    }
  })

  const html = earlyWarningReportPdf({
    schoolName:  school?.name ?? user.schoolName,
    generatedAt: new Date(),
    flags:       flagRows,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="early-warning-report-${date}.pdf"`,
    },
  })
}
