'use server'

import { requireAuth }  from '@/lib/session'
import { prisma }       from '@/lib/prisma'
import { redirect }     from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttendanceBand = { label: string; count: number; colour: string }
export type YearGroupRow   = {
  yearGroup:    number | null
  total:        number
  sendCount:    number
  ehcpCount:    number
  attendanceAvg: number | null
  behaviourRatio: number | null // positive / (positive + negative), 0-1
  fsmCount:     number
  ealCount:     number
}
export type NeedAreaRow  = { needArea: string; count: number }
export type AtRiskStudent = {
  id:          string
  firstName:   string
  lastName:    string
  yearGroup:   number | null
  riskFlags:   string[]
  sendStatus:  string | null
  attendance:  number | null
}

export type PopulationInsights = {
  // Cohort overview
  totalStudents:    number
  sendCount:        number
  ehcpCount:        number
  sendPercent:      number
  attendanceAvg:    number | null
  persistentAbsenceCount: number   // <80%
  atRiskCount:      number         // 3+ risk factors
  exclusionCount:   number

  // SEND profile
  sendBreakdown: { label: string; count: number }[]
  needAreaBreakdown: NeedAreaRow[]

  // Year group breakdown
  byYearGroup: YearGroupRow[]

  // Attendance bands
  attendanceBands: AttendanceBand[]

  // Behaviour summary
  behaviourPositiveTotal: number
  behaviourNegativeTotal: number

  // FSM / EAL
  fsmCount:   number
  ealCount:   number
  fsmEalDataAvailable: boolean

  // Performance gap (avg grade SEND vs non-SEND)
  avgGradeAllStudents:    number | null
  avgGradeSendStudents:   number | null
  avgGradeNoSendStudents: number | null

  // At-risk students (3+ flags)
  atRiskStudents: AtRiskStudent[]
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function getPopulationInsights(): Promise<PopulationInsights> {
  const { schoolId, role } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const termStart = new Date()
  termStart.setMonth(termStart.getMonth() - 4) // current term window

  const [students, recentSubmissions] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true },
      select: {
        id: true, firstName: true, lastName: true, yearGroup: true,
        attendancePercentage: true,
        behaviourPositive:    true,
        behaviourNegative:    true,
        hasExclusion:         true,
        isFsm:                true,
        isEal:                true,
        sendStatus: {
          select: { activeStatus: true, needArea: true },
        },
      },
    }),
    // Recent graded submissions for performance gap
    prisma.submission.findMany({
      where: {
        schoolId,
        markedAt:   { gte: termStart },
        finalScore: { not: null },
      },
      select: {
        studentId:  true,
        finalScore: true,
        homework:   { select: { gradingBands: true } },
      },
    }),
  ])

  // ── Compute score percentages per student ───────────────────────────────────

  const scoresByStudent = new Map<string, number[]>()
  for (const sub of recentSubmissions) {
    if (sub.finalScore == null) continue
    const bands = sub.homework.gradingBands as Record<string, unknown> | null
    const max   = bands ? Math.max(...Object.keys(bands).map(Number).filter(n => !isNaN(n))) : 9
    if (max <= 0) continue
    const pct = Math.round((sub.finalScore / max) * 100)
    if (!scoresByStudent.has(sub.studentId)) scoresByStudent.set(sub.studentId, [])
    scoresByStudent.get(sub.studentId)!.push(pct)
  }

  const avg = (nums: number[]) => nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null

  // ── Per-student risk flags ──────────────────────────────────────────────────

  const atRiskStudents: AtRiskStudent[] = []

  let sendCount  = 0
  let ehcpCount  = 0
  let persistentAbsenceCount = 0
  let exclusionCount         = 0
  let fsmCount               = 0
  let ealCount               = 0
  let fsmEalDataSeen         = false
  let behaviourPositiveTotal = 0
  let behaviourNegativeTotal = 0

  const needAreaMap   = new Map<string, number>()
  const yearGroupMap  = new Map<number | null, { students: typeof students; scores: number[] }>()

  const sendGrades:   number[] = []
  const noSendGrades: number[] = []
  const allGrades:    number[] = []

  for (const s of students) {
    const status  = s.sendStatus?.activeStatus ?? 'NONE'
    const isSend  = status !== 'NONE'
    const isEhcp  = status === 'EHCP'

    if (isSend)  sendCount++
    if (isEhcp)  ehcpCount++
    if (s.hasExclusion) exclusionCount++
    if (s.isFsm) { fsmCount++; fsmEalDataSeen = true }
    if (s.isEal) { ealCount++; fsmEalDataSeen = true }
    if (s.isFsm != null || s.isEal != null) fsmEalDataSeen = true

    behaviourPositiveTotal += s.behaviourPositive ?? 0
    behaviourNegativeTotal += s.behaviourNegative ?? 0

    if (s.attendancePercentage != null && s.attendancePercentage < 80) persistentAbsenceCount++

    // Need area
    const needArea = s.sendStatus?.needArea
    if (needArea) needAreaMap.set(needArea, (needAreaMap.get(needArea) ?? 0) + 1)

    // Year group bucket
    const yg = s.yearGroup ?? null
    if (!yearGroupMap.has(yg)) yearGroupMap.set(yg, { students: [], scores: [] })
    yearGroupMap.get(yg)!.students.push(s)

    // Performance
    const sScores = scoresByStudent.get(s.id) ?? []
    const sAvg    = avg(sScores)
    if (sAvg != null) {
      allGrades.push(sAvg)
      if (isSend)  sendGrades.push(sAvg)
      else         noSendGrades.push(sAvg)
      yearGroupMap.get(yg)!.scores.push(sAvg)
    }

    // Risk flags
    const flags: string[] = []
    if (isSend) flags.push('SEND need')
    if (s.attendancePercentage != null && s.attendancePercentage < 90) flags.push('Attendance <90%')
    if ((s.behaviourNegative ?? 0) > 3) flags.push('Behaviour concerns')
    if (sAvg != null && sAvg < 40) flags.push('Low attainment')
    if (s.hasExclusion) flags.push('Exclusion on record')
    if (s.isFsm) flags.push('FSM')

    if (flags.length >= 3) {
      atRiskStudents.push({
        id:         s.id,
        firstName:  s.firstName,
        lastName:   s.lastName,
        yearGroup:  s.yearGroup ?? null,
        riskFlags:  flags,
        sendStatus: isSend ? status : null,
        attendance: s.attendancePercentage ?? null,
      })
    }
  }

  // ── Attendance bands ────────────────────────────────────────────────────────

  const withAttendance = students.filter(s => s.attendancePercentage != null)
  const attendanceBands: AttendanceBand[] = [
    { label: '95%+',   count: withAttendance.filter(s => s.attendancePercentage! >= 95).length,                                    colour: '#22c55e' },
    { label: '90–95%', count: withAttendance.filter(s => s.attendancePercentage! >= 90 && s.attendancePercentage! < 95).length,    colour: '#84cc16' },
    { label: '80–90%', count: withAttendance.filter(s => s.attendancePercentage! >= 80 && s.attendancePercentage! < 90).length,    colour: '#f59e0b' },
    { label: '<80%',   count: withAttendance.filter(s => s.attendancePercentage! < 80).length,                                     colour: '#ef4444' },
  ]

  const attendanceAvg = avg(withAttendance.map(s => s.attendancePercentage!))

  // ── By year group ───────────────────────────────────────────────────────────

  const byYearGroup: YearGroupRow[] = Array.from(yearGroupMap.entries())
    .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
    .map(([yg, { students: ygStudents }]) => {
      const sendStudents  = ygStudents.filter(s => s.sendStatus?.activeStatus !== 'NONE' && s.sendStatus?.activeStatus != null)
      const ehcpStudents  = ygStudents.filter(s => s.sendStatus?.activeStatus === 'EHCP')
      const withAtt       = ygStudents.filter(s => s.attendancePercentage != null)
      const attAvg        = avg(withAtt.map(s => s.attendancePercentage!))
      const posTotal      = ygStudents.reduce((a, s) => a + (s.behaviourPositive ?? 0), 0)
      const negTotal      = ygStudents.reduce((a, s) => a + (s.behaviourNegative ?? 0), 0)
      const ratio         = posTotal + negTotal > 0 ? posTotal / (posTotal + negTotal) : null
      return {
        yearGroup:      yg,
        total:          ygStudents.length,
        sendCount:      sendStudents.length,
        ehcpCount:      ehcpStudents.length,
        attendanceAvg:  attAvg != null ? Math.round(attAvg * 10) / 10 : null,
        behaviourRatio: ratio != null ? Math.round(ratio * 100) / 100 : null,
        fsmCount:       ygStudents.filter(s => s.isFsm).length,
        ealCount:       ygStudents.filter(s => s.isEal).length,
      }
    })

  // ── Sort at-risk by flag count ──────────────────────────────────────────────

  atRiskStudents.sort((a, b) => b.riskFlags.length - a.riskFlags.length)

  return {
    totalStudents:    students.length,
    sendCount,
    ehcpCount,
    sendPercent:      students.length > 0 ? Math.round((sendCount / students.length) * 100) : 0,
    attendanceAvg:    attendanceAvg != null ? Math.round(attendanceAvg * 10) / 10 : null,
    persistentAbsenceCount,
    atRiskCount:      atRiskStudents.length,
    exclusionCount,

    sendBreakdown: [
      { label: 'No SEND',     count: students.length - sendCount },
      { label: 'SEN Support', count: sendCount - ehcpCount },
      { label: 'EHCP',        count: ehcpCount },
    ],
    needAreaBreakdown: Array.from(needAreaMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([needArea, count]) => ({ needArea, count })),

    byYearGroup,
    attendanceBands,

    behaviourPositiveTotal,
    behaviourNegativeTotal,

    fsmCount,
    ealCount,
    fsmEalDataAvailable: fsmEalDataSeen,

    avgGradeAllStudents:    avg(allGrades) != null ? Math.round(avg(allGrades)!) : null,
    avgGradeSendStudents:   avg(sendGrades) != null ? Math.round(avg(sendGrades)!) : null,
    avgGradeNoSendStudents: avg(noSendGrades) != null ? Math.round(avg(noSendGrades)!) : null,

    atRiskStudents: atRiskStudents.slice(0, 30),
  }
}
