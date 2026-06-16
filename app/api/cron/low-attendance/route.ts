import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { sendLowAttendanceAlertEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all active students with attendance below 90%
  const students = await prisma.user.findMany({
    where: {
      role:                  'STUDENT',
      isActive:              true,
      attendancePercentage:  { lt: 90, not: null },
    },
    select: {
      id: true, firstName: true, lastName: true,
      yearGroup: true, schoolId: true,
      attendancePercentage: true,
    },
    orderBy: { attendancePercentage: 'asc' },
  })

  if (students.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No students below 90% attendance' })
  }

  // Fetch SEND statuses for these students
  const studentIds  = students.map(s => s.id)
  const sendRecords = await prisma.sendStatus.findMany({
    where:  { studentId: { in: studentIds }, NOT: { activeStatus: 'NONE' } },
    select: { studentId: true, activeStatus: true },
  })
  const sendMap = new Map(sendRecords.map(r => [r.studentId, r.activeStatus]))

  // Group by school
  const bySchool = new Map<string, typeof students>()
  for (const s of students) {
    if (!bySchool.has(s.schoolId)) bySchool.set(s.schoolId, [])
    bySchool.get(s.schoolId)!.push(s)
  }

  let sent   = 0
  const errors: string[] = []

  for (const [schoolId, schoolStudents] of bySchool) {
    try {
      const school = await prisma.school.findUnique({
        where:  { id: schoolId },
        select: { name: true },
      })
      if (!school) continue

      // Find HOY(s) and SCHOOL_ADMIN(s) for notification
      const recipients = await prisma.user.findMany({
        where:  { schoolId, role: { in: ['HEAD_OF_YEAR', 'SCHOOL_ADMIN', 'SLT'] }, isActive: true },
        select: { id: true, firstName: true, email: true, role: true, yearGroup: true },
      })
      if (recipients.length === 0) continue

      const studentRows = schoolStudents.map(s => ({
        name:          `${s.firstName} ${s.lastName}`,
        yearGroup:     s.yearGroup,
        attendancePct: s.attendancePercentage!,
        sendStatus:    sendMap.get(s.id) ?? null,
      }))

      await Promise.allSettled(
        recipients.map(r => {
          // HOY: only see their own year group (if set); admins/SLT see all
          const filtered = r.role === 'HEAD_OF_YEAR' && r.yearGroup
            ? studentRows.filter(s => s.yearGroup === r.yearGroup)
            : studentRows

          if (filtered.length === 0) return Promise.resolve()

          return sendLowAttendanceAlertEmail({
            to:                 r.email,
            recipientFirstName: r.firstName,
            schoolName:         school.name,
            yearGroup:          r.role === 'HEAD_OF_YEAR' ? (r.yearGroup ?? undefined) : undefined,
            students:           filtered,
          })
        })
      )

      sent += recipients.length
    } catch (err) {
      errors.push(`schoolId ${schoolId}: ${String(err)}`)
    }
  }

  return NextResponse.json({
    ok:       errors.length === 0,
    sent,
    schools:  bySchool.size,
    students: students.length,
    errors:   errors.length > 0 ? errors : undefined,
  })
}
