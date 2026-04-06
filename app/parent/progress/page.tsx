import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import { PlanStatus } from '@prisma/client'
import Icon from '@/components/ui/Icon'
import { formatRawScore } from '@/lib/gradeUtils'

export default async function ParentProgressPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (role !== 'PARENT') redirect('/dashboard')

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: userId },
    include: {
      child: {
        include: {
          enrolments: {
            include: {
              class: {
                include: {
                  teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
                },
              },
            },
          },
        },
      },
    },
  })
  const children = links.map(l => l.child)

  const childProgress = await Promise.all(children.map(async (child: any) => {
    const classIds = child.enrolments.map((e: any) => e.classId)

    const allHw = await prisma.homework.findMany({
      where: {
        schoolId, classId: { in: classIds }, status: 'PUBLISHED',
        OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: child.id }],
      },
      include: {
        class: { select: { id: true, name: true, subject: true } },
        submissions: {
          where: { studentId: child.id },
          select: { id: true, status: true, grade: true, finalScore: true, submittedAt: true, feedback: true },
        },
      },
      orderBy: { dueAt: 'desc' },
    })

    // Deduplicate adapted versions
    const hwMap = new Map<string, any>()
    for (const hw of allHw) {
      const key = hw.lessonId ?? hw.id
      if (hw.isAdapted || !hwMap.has(key)) hwMap.set(key, hw)
    }
    const homework = Array.from(hwMap.values())

    // Group by class
    const byClass = new Map<string, { classInfo: any; teachers: string[]; hw: any[] }>()
    for (const hw of homework) {
      if (!byClass.has(hw.classId)) {
        const enrolment = child.enrolments.find((e: any) => e.classId === hw.classId)
        const teachers  = enrolment?.class.teachers.map((t: any) => `${t.user.firstName} ${t.user.lastName}`) ?? []
        byClass.set(hw.classId, { classInfo: hw.class, teachers, hw: [] })
      }
      byClass.get(hw.classId)!.hw.push(hw)
    }

    // Shared SEND plans
    const plans = await prisma.plan.findMany({
      where: { studentId: child.id, schoolId, status: PlanStatus.ACTIVE_PARENT_SHARED },
      include: { targets: true, strategies: true },
      orderBy: { activatedAt: 'desc' },
    })

    return { child, byClass: Array.from(byClass.values()), plans }
  }))

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="mb-8">
            <h1 className="text-[22px] font-bold text-gray-900">Progress & Grades</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Subject-by-subject breakdown</p>
          </div>

          {childProgress.map(({ child, byClass, plans }: any) => (
            <div key={child.id} className="mb-10">

              {/* Child header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-[13px]">{child.firstName[0]}{child.lastName[0]}</span>
                </div>
                <h2 className="text-[15px] font-bold text-gray-900">{child.firstName} {child.lastName}</h2>
              </div>

              {byClass.length === 0 && (
                <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl text-gray-400">
                  <Icon name="menu_book" size="lg" className="mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">No classes enrolled yet</p>
                </div>
              )}

              {/* Per-class sections */}
              {byClass.map(({ classInfo, teachers, hw }: any) => {
                const submitted  = hw.filter((h: any) => h.submissions[0])
                const graded     = hw.filter((h: any) => h.submissions[0]?.status === 'RETURNED')
                const scores     = graded.map((h: any) => h.submissions[0]!.finalScore).filter((s: any) => s != null) as number[]
                const avgScore   = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null
                const completion = hw.length ? Math.round((submitted.length / hw.length) * 100) : 0

                return (
                  <div key={classInfo.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">

                    {/* Class header */}
                    <div className="px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-[14px] font-semibold text-gray-900">{classInfo.name}</h3>
                          {teachers.length > 0 && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{teachers.join(', ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-5 text-right">
                          <div>
                            <p className="text-[18px] font-bold text-gray-900">{completion}%</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Completion</p>
                          </div>
                          {avgScore != null && (
                            <div>
                              <p className="text-[18px] font-bold text-blue-600">{formatRawScore(avgScore)}</p>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg Score</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Completion bar */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${completion}%` }} />
                      </div>
                    </div>

                    {/* Homework rows */}
                    <div className="divide-y divide-gray-100">
                      {hw.slice(0, 10).map((h: any) => {
                        const sub    = h.submissions[0]
                        const overdue = new Date(h.dueAt) < new Date() && !sub
                        return (
                          <div key={h.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="shrink-0">
                              {sub?.status === 'RETURNED'
                                ? <Icon name="check_circle" size="sm" className="text-green-500" />
                                : sub
                                  ? <Icon name="schedule" size="sm" className="text-amber-400" />
                                  : <Icon name="radio_button_unchecked" size="sm" className="text-gray-300" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-gray-900 truncate">{h.title}</p>
                              <p className="text-[11px] text-gray-400">
                                Due {new Date(h.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {h.isAdapted && <span className="ml-1.5 text-purple-500 font-medium">· Adapted</span>}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              {sub?.grade && (
                                <span className="inline-block bg-green-100 text-green-800 font-bold text-[12px] px-2.5 py-0.5 rounded-lg">{sub.grade}</span>
                              )}
                              {sub?.finalScore != null && !sub.grade && (
                                <span className="text-[12px] font-semibold text-gray-700">{formatRawScore(sub.finalScore)}</span>
                              )}
                              {!sub && (
                                <span className={`text-[11px] font-medium ${overdue ? 'text-rose-500' : 'text-gray-400'}`}>
                                  {overdue ? 'Overdue' : 'Pending'}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {hw.length === 0 && (
                        <p className="px-5 py-4 text-center text-[13px] text-gray-400">No homework yet</p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Shared SEND plans */}
              {plans.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Icon name="track_changes" size="sm" /> Support Plan
                  </h3>
                  {plans.map((plan: any) => (
                    <div key={plan.id} className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[13px] font-semibold text-purple-900">Active Support Plan</span>
                        <span className="text-[11px] text-purple-500">
                          Review {new Date(plan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {plan.targets.length > 0 && (
                        <div className="mb-5">
                          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">Targets</p>
                          <div className="space-y-3">
                            {plan.targets.map((t: any) => (
                              <div key={t.id} className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${t.achieved ? 'bg-green-200' : 'bg-purple-200'}`}>
                                  {t.achieved
                                    ? <Icon name="check_circle" size="sm" className="text-green-700" />
                                    : <Icon name="track_changes" size="sm" className="text-purple-700" />
                                  }
                                </div>
                                <div>
                                  <p className="text-[13px] font-medium text-purple-900">{t.metricKey}</p>
                                  <p className="text-[11px] text-purple-500">
                                    {t.needCategory}
                                    {t.baselineValue ? ` · From: ${t.baselineValue}` : ''} → {t.targetValue}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Home strategies only */}
                      {plan.strategies.filter((s: any) => s.appliesTo === 'HOMEWORK' || s.appliesTo === 'BOTH').length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">How you can help at home</p>
                          <div className="space-y-1.5">
                            {plan.strategies
                              .filter((s: any) => s.appliesTo === 'HOMEWORK' || s.appliesTo === 'BOTH')
                              .map((s: any) => (
                                <div key={s.id} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                                  <p className="text-[12px] text-purple-800">{s.strategyText}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}

        </div>
      </main>
    </AppShell>
  )
}
