import { requireAuth } from '@/lib/session'
import { redirect }    from 'next/navigation'
import { prisma }      from '@/lib/prisma'
import AppShell        from '@/components/AppShell'
import Link            from 'next/link'
import Icon            from '@/components/ui/Icon'
import PrintButton     from '@/components/ui/PrintButton'

// ── helpers ───────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colour = 'text-gray-900', icon, href,
}: {
  label: string; value: string | number; sub?: string
  colour?: string; icon: string; href?: string
}) {
  const inner = (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 hover:border-blue-200 transition">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon name={icon} size="md" className="text-gray-400" />
      </div>
      <div>
        <p className={`text-[26px] font-bold leading-none ${colour}`}>{value}</p>
        <p className="text-[12px] text-gray-400 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-gray-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>
}

function SectionCard({ title, icon, action, children }: {
  title: string; icon: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Icon name={icon} size="sm" className="text-gray-400" />
          <h2 className="text-[13px] font-semibold text-gray-800">{title}</h2>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  )
}

function QuickLink({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/30 transition group">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <Icon name={icon} size="sm" className="text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 group-hover:text-blue-700 transition">{label}</p>
        <p className="text-[11px] text-gray-400 truncate">{desc}</p>
      </div>
    </Link>
  )
}

const CATEGORY_LABEL: Record<string, string> = {
  literacy:         'Literacy',
  numeracy:         'Numeracy',
  behaviour:        'Behaviour',
  attendance:       'Attendance',
  social_emotional: 'Social / Emotional',
  communication:    'Communication',
  physical:         'Physical',
  sensory:          'Sensory',
  other:            'Other',
}

const STATUS_COLOUR: Record<string, string> = {
  open:         'bg-red-100 text-red-700',
  under_review: 'bg-amber-100 text-amber-700',
  escalated:    'bg-red-200 text-red-800 font-semibold',
  monitoring:   'bg-blue-100 text-blue-700',
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function HoyDashboardPage() {
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = await requireAuth()
  if (!['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── HOY year group ───────────────────────────────────────────────────────────
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { yearGroup: true },
  })
  const myYearGroup = role === 'HEAD_OF_YEAR' ? (userRecord?.yearGroup ?? null) : null

  // ── Students in year group ───────────────────────────────────────────────────
  const yearStudents = await prisma.user.findMany({
    where: {
      schoolId,
      role: 'STUDENT',
      isActive: true,
      ...(myYearGroup ? { yearGroup: myYearGroup } : {}),
    },
    select: { id: true, firstName: true, lastName: true, yearGroup: true, attendancePercentage: true, behaviourPositive: true, behaviourNegative: true },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })

  const studentIds = yearStudents.map(s => s.id)

  // ── Parallel data fetches ────────────────────────────────────────────────────
  const in30days  = new Date(Date.now() + 30 * 86_400_000)
  const in14days  = new Date(Date.now() + 14 * 86_400_000)
  const last30    = new Date(Date.now() - 30 * 86_400_000)

  const [
    sendCount,
    openConcerns,
    ilpReviewsDue,
    ehcpReviewsDue,
    apdrDue,
    classes,
  ] = await Promise.all([
    // SEND students in year group
    prisma.sendStatus.count({
      where: { studentId: { in: studentIds }, NOT: { activeStatus: 'NONE' } },
    }),

    // Open concerns for year group
    prisma.sendConcern.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: { in: ['open', 'under_review', 'escalated'] },
      },
      select: {
        id: true, category: true, status: true, description: true, createdAt: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 8,
    }),

    // ILP reviews due within 30 days
    prisma.individualLearningPlan.findMany({
      where: {
        schoolId,
        student: { id: { in: studentIds } },
        status: { in: ['active', 'ACTIVE'] },
        reviewDate: { lte: in30days, gte: new Date() },
      },
      select: {
        id: true, reviewDate: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { reviewDate: 'asc' },
      take: 10,
    }),

    // EHCP reviews due
    prisma.ehcpPlan.findMany({
      where: {
        schoolId,
        student: { id: { in: studentIds } },
        status: { in: ['active', 'under_review'] },
        reviewDate: { lte: in30days, gte: new Date() },
      },
      select: {
        id: true, reviewDate: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { reviewDate: 'asc' },
      take: 10,
    }),

    // APDR cycles review due within 14 days
    prisma.assessPlanDoReview.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: { notIn: ['COMPLETED'] },
        reviewDate: { lte: in14days, gte: new Date() },
      },
      select: {
        id: true, cycleNumber: true, reviewDate: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { reviewDate: 'asc' },
      take: 10,
    }),

    // Classes for year group
    prisma.schoolClass.findMany({
      where: {
        schoolId,
        ...(myYearGroup ? { yearGroup: myYearGroup } : {}),
      },
      select: {
        id: true, name: true, subject: true, yearGroup: true,
        teachers: { include: { user: { select: { firstName: true, lastName: true } } }, take: 1 },
        _count: { select: { enrolments: true } },
      },
      orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }],
      take: 20,
    }),

  ])

  // ── Attendance alerts: below 90% ─────────────────────────────────────────────
  const attendanceAlerts = yearStudents
    .filter(s => s.attendancePercentage != null && s.attendancePercentage < 90)
    .sort((a, b) => (a.attendancePercentage ?? 100) - (b.attendancePercentage ?? 100))
    .slice(0, 10)

  // ── Per-class homework stats ─────────────────────────────────────────────────
  const classIds = classes.map(c => c.id)

  const hwByClass = await prisma.homework.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, status: 'PUBLISHED', createdAt: { gte: last30 } },
    _count: { id: true },
  })
  const hwCountByClass = new Map(hwByClass.map(h => [h.classId, h._count.id]))

  // Submissions per class via homework join
  const recentHwIds = (await prisma.homework.findMany({
    where: { classId: { in: classIds }, status: 'PUBLISHED', createdAt: { gte: last30 } },
    select: { id: true, classId: true },
  }))
  const hwToClassMap = new Map(recentHwIds.map(h => [h.id, h.classId]))
  const subRows = await prisma.submission.groupBy({
    by: ['homeworkId'],
    where: { homeworkId: { in: recentHwIds.map(h => h.id) }, submittedAt: { gte: last30 } },
    _count: { id: true },
  })
  const subByClass = new Map<string, number>()
  for (const r of subRows) {
    const cid = hwToClassMap.get(r.homeworkId)
    if (cid) subByClass.set(cid, (subByClass.get(cid) ?? 0) + r._count.id)
  }

  // ── KPI derivations ──────────────────────────────────────────────────────────
  const reviewsDueCount    = ilpReviewsDue.length + ehcpReviewsDue.length + apdrDue.length
  const lowAttendanceCount = yearStudents.filter(s => s.attendancePercentage != null && s.attendancePercentage < 90).length
  const hasAttendanceData  = yearStudents.some(s => s.attendancePercentage != null)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">

          {/* Print styles */}
          <style>{`@media print{nav,aside,[data-sidebar],.print\\:hidden{display:none!important}body{background:#fff}}`}</style>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">
                {greeting}, {firstName}
              </h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {myYearGroup ? `Year ${myYearGroup} pastoral overview` : 'Pastoral overview — all year groups'}
                {' · '}{schoolName}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <PrintButton label="Print" />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard label="Students"       value={yearStudents.length}   icon="people"         href={myYearGroup ? `/analytics?year=${myYearGroup}` : '/analytics'} />
            <StatCard label="SEND Register"  value={sendCount}             icon="support"        colour={sendCount > 0 ? 'text-purple-700' : 'text-gray-300'} href="/senco/concerns" />
            <StatCard label="Open Concerns"  value={openConcerns.length}   icon="report_problem" colour={openConcerns.length > 0 ? 'text-red-600' : 'text-gray-300'} href="/senco/concerns" />
            <StatCard label="Reviews Due"    value={reviewsDueCount}       icon="event"          colour={reviewsDueCount > 0 ? 'text-amber-600' : 'text-gray-300'} />
            <StatCard label="Low Attendance" value={lowAttendanceCount}    icon="directions_run" colour={lowAttendanceCount > 0 ? 'text-red-600' : 'text-gray-300'} />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickLink href="/hoy/analytics"  icon="bar_chart"       label="Year Analytics"  desc="Performance & at-risk" />
            <QuickLink href="/hoy/integrity"  icon="verified_user"   label="Integrity"       desc="Flagged submissions" />
            <QuickLink href="/senco/concerns" icon="report_problem"  label="SEND Concerns"   desc="Open & escalated" />
            <QuickLink href="/senco/ilp"      icon="description"     label="ILP Records"     desc="Individual learning plans" />
          </div>

          {/* Two-column: Attendance + Concerns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Attendance alerts */}
            <SectionCard
              title={`Low Attendance (< 90%)`}
              icon="directions_run"
              action={
                attendanceAlerts.length > 0
                  ? <span className="text-[11px] text-gray-400">{attendanceAlerts.length} flagged</span>
                  : undefined
              }
            >
              {!hasAttendanceData ? (
                <div className="px-5 py-8 text-center">
                  <Icon name="sync" size="md" className="text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-500 font-medium">No attendance data yet</p>
                  <p className="text-[12px] text-gray-400 mt-1">Attendance is synced from your MIS via Wonde.</p>
                  <Link href="/admin/wonde" className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline mt-2">
                    <Icon name="sync" size="sm" /> Run MIS sync
                  </Link>
                </div>
              ) : attendanceAlerts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Icon name="check_circle" size="md" className="text-green-400 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No students below 90% attendance</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {attendanceAlerts.map(s => {
                    const pct = s.attendancePercentage!
                    const colour = pct < 80 ? 'text-red-600 font-bold' : 'text-amber-600 font-semibold'
                    return (
                      <li key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                        <Link href={`/students/${s.id}`} className="text-[13px] font-medium text-gray-800 hover:text-blue-600 transition">
                          {s.firstName} {s.lastName}
                          {s.yearGroup && <span className="ml-1.5 text-[11px] text-gray-400">Yr {s.yearGroup}</span>}
                        </Link>
                        <span className={`text-[13px] ${colour}`}>{pct.toFixed(1)}%</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>

            {/* Open SEND concerns */}
            <SectionCard
              title="Open SEND Concerns"
              icon="report_problem"
              action={
                openConcerns.length > 0
                  ? <Link href="/senco/concerns" className="text-[11px] text-blue-600 hover:underline">View all</Link>
                  : undefined
              }
            >
              {openConcerns.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Icon name="check_circle" size="md" className="text-green-400 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No open concerns</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {openConcerns.map(c => (
                    <li key={c.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/students/${c.student.id}`} className="text-[13px] font-medium text-gray-800 hover:text-blue-600 transition">
                          {c.student.firstName} {c.student.lastName}
                        </Link>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOUR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {CATEGORY_LABEL[c.category] ?? c.category} · {c.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Upcoming reviews */}
          {(ilpReviewsDue.length > 0 || ehcpReviewsDue.length > 0 || apdrDue.length > 0) && (
            <SectionCard title="Upcoming Reviews (next 30 days)" icon="event">
              <div className="divide-y divide-gray-100">
                {[
                  ...ilpReviewsDue.map(r => ({ ...r, type: 'ILP', studentId: r.student.id, name: `${r.student.firstName} ${r.student.lastName}` })),
                  ...ehcpReviewsDue.map(r => ({ ...r, type: 'EHCP', studentId: r.student.id, name: `${r.student.firstName} ${r.student.lastName}` })),
                  ...apdrDue.map(r => ({ ...r, type: `APDR Cycle ${r.cycleNumber}`, studentId: r.student.id, name: `${r.student.firstName} ${r.student.lastName}` })),
                ]
                  .sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime())
                  .slice(0, 12)
                  .map((r, i) => {
                    const daysLeft = Math.ceil((new Date(r.reviewDate).getTime() - Date.now()) / 86_400_000)
                    const urgent = daysLeft <= 7
                    return (
                      <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                        <div>
                          <Link href={`/students/${r.studentId}`} className="text-[13px] font-medium text-gray-800 hover:text-blue-600 transition">
                            {r.name}
                          </Link>
                          <span className="ml-2 text-[11px] text-gray-400">{r.type}</span>
                        </div>
                        <span className={`text-[12px] font-medium ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
                          {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </SectionCard>
          )}

          {/* Class homework pulse */}
          {classes.length > 0 && (
            <SectionCard
              title="Homework Pulse (last 30 days)"
              icon="assignment"
              action={<Link href="/hoy/analytics" className="text-[11px] text-blue-600 hover:underline print:hidden">Full analytics</Link>}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Class</th>
                      <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Subject</th>
                      <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Teacher</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium">HW Set</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium">Submitted</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {classes.map(c => {
                      const hwSet  = hwCountByClass.get(c.id) ?? 0
                      const subCount = subByClass.get(c.id) ?? 0
                      const expected = hwSet * c._count.enrolments
                      const rate  = expected > 0 ? subCount / expected : null
                      const teacher = c.teachers[0]?.user
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 font-medium text-gray-800">{c.name}</td>
                          <td className="px-3 py-2.5 text-gray-500">{c.subject}</td>
                          <td className="px-3 py-2.5 text-gray-500">{teacher ? `${teacher.firstName[0]}. ${teacher.lastName}` : '—'}</td>
                          <td className="px-5 py-2.5 text-right text-gray-600">{hwSet || '—'}</td>
                          <td className="px-5 py-2.5 text-right text-gray-600">{hwSet > 0 ? subCount : '—'}</td>
                          <td className="px-5 py-2.5 text-right">
                            {rate != null ? (
                              <span className={`font-semibold ${
                                rate >= 0.8 ? 'text-green-600' : rate >= 0.6 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {Math.round(rate * 100)}%
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

        </div>
      </main>
    </AppShell>
  )
}
