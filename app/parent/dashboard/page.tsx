import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function ParentDashboardPage() {
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'PARENT') redirect('/dashboard')

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: userId },
    include: {
      child: {
        include: {
          enrolments: { include: { class: true } },
        },
      },
    },
  })
  const children = links.map(l => l.child)

  const childData = await Promise.all(children.map(async (child: any) => {
    const classIds = child.enrolments.map((e: any) => e.classId)

    const allHw = await prisma.homework.findMany({
      where: {
        schoolId, classId: { in: classIds }, status: 'PUBLISHED',
        OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: child.id }],
      },
      include: {
        class:       { select: { name: true } },
        submissions: { where: { studentId: child.id }, select: { id: true, status: true, grade: true, submittedAt: true } },
      },
      orderBy: { dueAt: 'desc' },
    })

    // Prefer adapted version for duplicate lessons
    const hwMap = new Map<string, any>()
    for (const hw of allHw) {
      const key = hw.lessonId ?? hw.id
      if (hw.isAdapted || !hwMap.has(key)) hwMap.set(key, hw)
    }
    const homework = Array.from(hwMap.values())

    const now      = new Date()
    const pending  = homework.filter((h: any) => !h.submissions[0] && new Date(h.dueAt) >= now)
    const awaiting = homework.filter((h: any) => h.submissions[0] && h.submissions[0].status !== 'RETURNED')
    const graded   = homework.filter((h: any) => h.submissions[0]?.status === 'RETURNED')
    const total    = homework.filter((h: any) => h.submissions[0]).length
    const completion = homework.length ? Math.round((total / homework.length) * 100) : 0

    const [plan, learningProfile] = await Promise.all([
      prisma.plan.findFirst({
        where: { studentId: child.id, schoolId, status: PlanStatus.ACTIVE_PARENT_SHARED },
        include: { targets: true },
        orderBy: { activatedAt: 'desc' },
      }),
      prisma.studentLearningProfile.findUnique({
        where: { studentId: child.id },
        select: { strengthAreas: true, developmentAreas: true, profileSummary: true },
      }),
    ])

    // Subject averages + trend from returned homework (GCSE grade scale)
    const subjectGrades: Record<string, Array<{ g: number; at: Date }>> = {}
    for (const hw of graded) {
      const sub = hw.submissions[0]
      const g = sub?.grade ? parseInt(sub.grade, 10) : null
      if (g != null && !isNaN(g)) {
        const subject = hw.class.name.replace(/\s*(Y\d+|Year\s*\d+|\d+[A-Z]?)$/i, '').trim() || hw.class.name
        if (!subjectGrades[subject]) subjectGrades[subject] = []
        subjectGrades[subject].push({ g, at: new Date(sub.submittedAt ?? 0) })
      }
    }
    const subjectAverages = Object.entries(subjectGrades)
      .map(([subject, entries]) => {
        const sorted = entries.sort((a, b) => a.at.getTime() - b.at.getTime())
        const avg = Math.round(sorted.reduce((s, e) => s + e.g, 0) / sorted.length)
        // Trend: compare last 2 submissions vs 2 before that (need ≥ 4)
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (sorted.length >= 4) {
          const recent = sorted.slice(-2).reduce((s, e) => s + e.g, 0) / 2
          const older  = sorted.slice(-4, -2).reduce((s, e) => s + e.g, 0) / 2
          if (recent - older >= 0.5) trend = 'up'
          else if (older - recent >= 0.5) trend = 'down'
        }
        return { subject, avg, trend }
      })
      .sort((a, b) => b.avg - a.avg)

    return { child, homework, pending, awaiting, graded, completion, plan, learningProfile, subjectAverages }
  }))

  const [unreadMsgs, activityFeed] = await Promise.all([
    prisma.parentConversation.count({
      where: {
        schoolId, parentId: userId,
        parentMessages: { some: { senderType: 'TEACHER', readAt: null } },
      },
    }),
    // Activity feed — in-app notifications for this parent (homework set, graded, etc.)
    prisma.notification.findMany({
      where:   { userId, schoolId },
      orderBy: { createdAt: 'desc' },
      take:    10,
    }),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Welcome, {firstName}</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{schoolName}</p>
            </div>
            {unreadMsgs > 0 && (
              <Link href="/parent/messages" className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-[12px] font-semibold rounded-xl hover:bg-blue-700 transition">
                <Icon name="chat" size="sm" />
                {unreadMsgs} new message{unreadMsgs !== 1 ? 's' : ''}
              </Link>
            )}
          </div>

          {/* Activity Feed */}
          {activityFeed.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
                <Icon name="notifications_active" size="sm" className="text-blue-600" />
                <h3 className="text-[13px] font-semibold text-gray-900">Activity</h3>
                {activityFeed.some(n => !n.read) && (
                  <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                    {activityFeed.filter(n => !n.read).length} new
                  </span>
                )}
              </div>
              <ul className="divide-y divide-gray-50">
                {activityFeed.map((n: any) => (
                  <li key={n.id}>
                    {n.linkHref ? (
                      <Link href={n.linkHref} className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition ${!n.read ? 'bg-blue-50/40' : ''}`}>
                        <Icon name="chevron_right" size="sm" className="text-gray-300 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                          {n.body && <p className="text-[11px] text-gray-400 mt-0.5">{n.body}</p>}
                        </div>
                        <time className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </time>
                      </Link>
                    ) : (
                      <div className={`flex items-start gap-3 px-5 py-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                        <Icon name="circle" size="sm" className="text-gray-200 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                          {n.body && <p className="text-[11px] text-gray-400 mt-0.5">{n.body}</p>}
                        </div>
                        <time className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </time>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {children.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl text-gray-400">
              <Icon name="assignment" size="lg" className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No children linked to your account</p>
              <p className="text-[13px] mt-1">Please contact the school admin</p>
            </div>
          )}

          {childData.map(({ child, homework, pending, awaiting, graded, completion, plan, learningProfile, subjectAverages }: any) => (
            <div key={child.id} className="mb-10">

              {/* Child header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-[15px]">{child.firstName[0]}{child.lastName[0]}</span>
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-gray-900">{child.firstName} {child.lastName}</h2>
                  <p className="text-[12px] text-gray-400">
                    {child.enrolments.map((e: any) => e.class.name).join(' · ')}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[22px] font-bold text-amber-600">{pending.length}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Due</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[22px] font-bold text-blue-600">{awaiting.length}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Awaiting Mark</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[22px] font-bold text-green-600">{graded.length}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Graded</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[22px] font-bold text-gray-900">{completion}%</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Completion</p>
                </div>
              </div>

              {/* Recent homework */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <h3 className="text-[13px] font-semibold text-gray-900">Recent Homework</h3>
                  <Link href="/parent/progress" className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                    View all <Icon name="chevron_right" size="sm" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {homework.slice(0, 6).map((hw: any) => {
                    const sub    = hw.submissions[0]
                    const overdue = new Date(hw.dueAt) < new Date() && !sub
                    return (
                      <div key={hw.id} className="flex items-center justify-between px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-gray-900 truncate">{hw.title}</p>
                          <p className="text-[11px] text-gray-400">
                            {hw.class.name} · Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div className="shrink-0 ml-4">
                          {sub?.grade
                            ? <span className="bg-green-100 text-green-800 font-bold text-[12px] px-3 py-0.5 rounded-lg">{sub.grade}</span>
                            : sub
                              ? <span className="bg-blue-50 text-blue-700 text-[11px] font-medium px-2.5 py-0.5 rounded-full">Submitted</span>
                              : overdue
                                ? <span className="bg-rose-50 text-rose-600 text-[11px] font-medium px-2.5 py-0.5 rounded-full">Overdue</span>
                                : <span className="bg-amber-50 text-amber-700 text-[11px] font-medium px-2.5 py-0.5 rounded-full">Pending</span>
                          }
                        </div>
                      </div>
                    )
                  })}
                  {homework.length === 0 && (
                    <p className="px-5 py-6 text-center text-[13px] text-gray-400">No homework assigned yet</p>
                  )}
                </div>
              </div>

              {/* SEND plan snippet */}
              {plan && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon name="track_changes" size="sm" className="text-purple-600" />
                      <h3 className="text-[13px] font-semibold text-purple-900">Support Plan — Shared with you</h3>
                    </div>
                    <span className="text-[11px] text-purple-500">
                      Review {new Date(plan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {plan.targets.slice(0, 3).map((t: any) => (
                      <div key={t.id} className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${t.achieved ? 'bg-green-500' : 'bg-purple-400'}`} />
                        <div>
                          <p className="text-[12px] font-medium text-purple-900">{t.metricKey}</p>
                          {t.baselineValue && <p className="text-[11px] text-purple-500">{t.baselineValue} → {t.targetValue}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/parent/progress" className="mt-3 inline-flex items-center gap-1 text-[11px] text-purple-700 font-medium hover:underline">
                    View full plan <Icon name="chevron_right" size="sm" />
                  </Link>
                </div>
              )}

              {/* Attendance */}
              {child.attendancePercentage != null && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-4 ${
                  child.attendancePercentage >= 95 ? 'bg-green-50 border-green-200' :
                  child.attendancePercentage >= 85 ? 'bg-amber-50 border-amber-200' :
                                                     'bg-rose-50 border-rose-200'
                }`}>
                  <Icon name="event_available" size="sm" className={
                    child.attendancePercentage >= 95 ? 'text-green-600' :
                    child.attendancePercentage >= 85 ? 'text-amber-600' : 'text-rose-600'
                  } />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-900">Attendance</p>
                    <p className="text-[11px] text-gray-500">
                      {child.attendancePercentage >= 95 ? 'Excellent attendance' :
                       child.attendancePercentage >= 85 ? 'Below target — please speak with school' :
                       'Attendance concern — please contact school urgently'}
                    </p>
                  </div>
                  <span className={`text-[16px] font-bold ${
                    child.attendancePercentage >= 95 ? 'text-green-700' :
                    child.attendancePercentage >= 85 ? 'text-amber-700' : 'text-rose-700'
                  }`}>{Math.round(child.attendancePercentage)}%</span>
                </div>
              )}

              {/* Subject performance */}
              {subjectAverages.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                  <div className="px-5 py-3.5 border-b border-gray-100">
                    <h3 className="text-[13px] font-semibold text-gray-900">Subject Performance</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Based on returned homework</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {subjectAverages.slice(0, 5).map(({ subject, avg, trend }: any) => (
                      <div key={subject} className="flex items-center justify-between px-5 py-2.5">
                        <p className="text-[13px] text-gray-700">{subject}</p>
                        <div className="flex items-center gap-1.5">
                          {trend === 'up'   && <Icon name="trending_up"   size="sm" className="text-green-500" />}
                          {trend === 'down' && <Icon name="trending_down" size="sm" className="text-rose-500"  />}
                          <span className={`text-[12px] font-bold px-2 py-0.5 rounded-lg ${
                            avg >= 7 ? 'bg-green-100 text-green-800' :
                            avg >= 5 ? 'bg-amber-100 text-amber-800' :
                                       'bg-rose-100 text-rose-800'
                          }`}>Grade {avg}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning insights */}
              {learningProfile && (learningProfile.strengthAreas.length > 0 || learningProfile.developmentAreas.length > 0) && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="auto_stories" size="sm" className="text-indigo-600" />
                    <h3 className="text-[13px] font-semibold text-indigo-900">Learning Insights</h3>
                  </div>
                  {learningProfile.strengthAreas.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">Strengths</p>
                      <p className="text-[12px] text-indigo-800">{learningProfile.strengthAreas.slice(0, 2).join(' · ')}</p>
                    </div>
                  )}
                  {learningProfile.developmentAreas.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Focus areas</p>
                      <p className="text-[12px] text-indigo-800">{learningProfile.developmentAreas.slice(0, 2).join(' · ')}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Quick-link cards */}
              <div className="grid grid-cols-2 gap-3">
                <Link href="/parent/progress" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 hover:shadow-sm transition group">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="bar_chart" size="sm" className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900">Progress & Grades</p>
                    <p className="text-[11px] text-gray-400">Subject breakdown</p>
                  </div>
                  <Icon name="chevron_right" size="sm" className="text-gray-300 ml-auto shrink-0 group-hover:text-blue-400 transition" />
                </Link>
                <Link href="/parent/messages" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-green-300 hover:shadow-sm transition group">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="chat" size="sm" className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900">Messages</p>
                    <p className="text-[11px] text-gray-400">Contact teachers</p>
                  </div>
                  <Icon name="chevron_right" size="sm" className="text-gray-300 ml-auto shrink-0 group-hover:text-green-400 transition" />
                </Link>
              </div>

            </div>
          ))}

        </div>
      </main>
    </AppShell>
  )
}
