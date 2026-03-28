import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus } from '@prisma/client'

export default async function ParentDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
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

    const plan = await prisma.plan.findFirst({
      where: { studentId: child.id, schoolId, status: PlanStatus.ACTIVE_PARENT_SHARED },
      include: { targets: true },
      orderBy: { activatedAt: 'desc' },
    })

    return { child, homework, pending, awaiting, graded, completion, plan }
  }))

  const unreadMsgs = await prisma.parentConversation.count({
    where: {
      schoolId, parentId: userId,
      parentMessages: { some: { senderType: 'TEACHER', readAt: null } },
    },
  })

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

          {children.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl text-gray-400">
              <Icon name="assignment" size="lg" className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No children linked to your account</p>
              <p className="text-[13px] mt-1">Please contact the school admin</p>
            </div>
          )}

          {childData.map(({ child, homework, pending, awaiting, graded, completion, plan }: any) => (
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
