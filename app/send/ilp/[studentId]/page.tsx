import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus, StrategyAppliesTo } from '@prisma/client'
import { getIlpEvidenceForStudent } from '@/app/actions/homework'
import { formatRawScore } from '@/lib/gradeUtils'

export default async function StudentIlpPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SCHOOL_ADMIN', 'SLT', 'HEAD_OF_YEAR', 'TEACHER'].includes(role)) redirect('/dashboard')

  const { studentId } = await params

  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, firstName: true, lastName: true, yearGroup: true, department: true },
  })
  if (!student) notFound()

  const [sendStatus, plan, enrolments, ilpEvidence] = await Promise.all([
    prisma.sendStatus.findUnique({ where: { studentId } }),
    prisma.plan.findFirst({
      where: {
        schoolId, studentId,
        status: { notIn: [PlanStatus.ARCHIVED] },
      },
      include: {
        targets:      true,
        strategies:   true,
        reviewCycles: { orderBy: { cycleStartDate: 'desc' }, take: 3 },
      },
      orderBy: { activatedAt: 'desc' },
    }),
    prisma.enrolment.findMany({
      where: { userId: studentId },
      include: {
        class: {
          include: {
            teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
    getIlpEvidenceForStudent(studentId),
  ])

  const classIds = enrolments.map(e => e.classId)

  const submissions = await prisma.submission.findMany({
    where: { studentId, schoolId, homework: { classId: { in: classIds } } },
    include: {
      homework: {
        select: { title: true, dueAt: true, maxAttempts: true, class: { select: { name: true } } },
      },
    },
    orderBy: { submittedAt: 'desc' },
    take: 20,
  })

  const now   = new Date()
  const in14  = new Date(now.getTime() + 14 * 86_400_000)
  const in30  = new Date(now.getTime() + 30 * 86_400_000)

  const reviewDate   = plan ? new Date(plan.reviewDate) : null
  const reviewUrgent = reviewDate ? reviewDate <= in14 : false
  const reviewWarn   = reviewDate ? reviewDate <= in30 : false

  // Group strategies by who they apply to
  const classroomStrats = plan?.strategies.filter(s => s.appliesTo === StrategyAppliesTo.CLASSROOM || s.appliesTo === StrategyAppliesTo.BOTH) ?? []
  const hwStrats        = plan?.strategies.filter(s => s.appliesTo === StrategyAppliesTo.HOMEWORK  || s.appliesTo === StrategyAppliesTo.BOTH) ?? []

  // Group submissions by class
  const subsByClass: Record<string, typeof submissions> = {}
  for (const sub of submissions) {
    const cls = sub.homework.class?.name ?? 'Unknown'
    if (!subsByClass[cls]) subsByClass[cls] = []
    subsByClass[cls].push(sub)
  }

  // Collect misconception tags across all submissions
  const misconceptions: Record<string, number> = {}
  for (const sub of submissions) {
    if (Array.isArray(sub.misconceptionTags)) {
      for (const tag of sub.misconceptionTags as string[]) {
        misconceptions[tag] = (misconceptions[tag] ?? 0) + 1
      }
    }
  }
  const topMisconceptions = Object.entries(misconceptions).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const planStatusLabel: Record<string, string> = {
    [PlanStatus.DRAFT]:                'Draft',
    [PlanStatus.ACTIVE_INTERNAL]:      'Active (Internal)',
    [PlanStatus.ACTIVE_PARENT_SHARED]: 'Active — Shared with Parent',
    [PlanStatus.ARCHIVED]:             'Archived',
  }
  const planStatusStyle: Record<string, string> = {
    [PlanStatus.DRAFT]:                'bg-gray-100 text-gray-500',
    [PlanStatus.ACTIVE_INTERNAL]:      'bg-teal-50 text-teal-700',
    [PlanStatus.ACTIVE_PARENT_SHARED]: 'bg-green-100 text-green-700',
    [PlanStatus.ARCHIVED]:             'bg-gray-100 text-gray-400',
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Back + header */}
          <div className="flex items-start gap-3 mb-8">
            <Link href="/send/ilp" className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700 shrink-0">
              <Icon name="chevron_left" size="sm" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-[13px]">{student.firstName[0]}{student.lastName[0]}</span>
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-gray-900 leading-tight">{student.firstName} {student.lastName}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {student.yearGroup && (
                      <span className="text-[11px] text-gray-400">Year {student.yearGroup}</span>
                    )}
                    {sendStatus && sendStatus.activeStatus !== 'NONE' && (
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        sendStatus.activeStatus === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {sendStatus.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                      </span>
                    )}
                    {sendStatus?.needArea && (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {sendStatus.needArea}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left column: Plan ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Plan header */}
              {plan ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Icon name="track_changes" size="sm" className="text-blue-600" />
                      <h2 className="text-[14px] font-semibold text-gray-900">Support Plan</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {reviewDate && (
                        <span className={`text-[11px] font-semibold ${
                          reviewUrgent ? 'text-red-600' : reviewWarn ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {reviewUrgent && <Icon name="warning" size="sm" className="inline mr-1" />}
                          Review {reviewDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${planStatusStyle[plan.status] ?? ''}`}>
                        {planStatusLabel[plan.status] ?? plan.status}
                      </span>
                    </div>
                  </div>

                  {/* Targets */}
                  {plan.targets.length > 0 && (
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Targets</h3>
                      <div className="space-y-4">
                        {plan.targets.map(t => (
                          <div key={t.id} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              t.achieved ? 'bg-green-100' : 'bg-blue-50'
                            }`}>
                              {t.achieved
                                ? <Icon name="check_circle" size="sm" className="text-green-600" />
                                : <Icon name="radio_button_unchecked" size="sm" className="text-blue-400" />
                              }
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-semibold text-gray-900">{t.metricKey}</p>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{t.needCategory}</span>
                                {t.achieved && <span className="text-[10px] font-bold text-green-600">Achieved</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {t.baselineValue && (
                                  <span className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded">From: {t.baselineValue}</span>
                                )}
                                <span className="text-[10px] text-gray-400">→</span>
                                <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">{t.targetValue}</span>
                              </div>
                              {t.measurementWindow && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{t.measurementWindow}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* In-class strategies */}
                  {classroomStrats.length > 0 && (
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">In-Classroom Strategies</h3>
                      <div className="space-y-2">
                        {classroomStrats.map(s => (
                          <div key={s.id} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                            <p className="text-[12px] text-gray-700">{s.strategyText}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Homework strategies */}
                  {hwStrats.length > 0 && (
                    <div className="px-5 py-4">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Homework Strategies</h3>
                      <div className="space-y-2">
                        {hwStrats.map(s => (
                          <div key={s.id} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                            <p className="text-[12px] text-gray-700">{s.strategyText}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl py-10 text-center text-gray-400">
                  <Icon name="track_changes" size="lg" className="mx-auto mb-2 opacity-30" />
                  <p className="text-[13px] font-medium">No active plan</p>
                  <p className="text-[11px] mt-1">A plan can be created and assigned by the SENCo</p>
                </div>
              )}

              {/* Homework submissions by class */}
              {/* ILP Evidence Timeline */}
              {ilpEvidence.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <Icon name="task_alt" size="sm" className="text-blue-500" />
                    <h2 className="text-[14px] font-semibold text-gray-900">ILP Evidence Timeline</h2>
                    <span className="ml-auto text-[11px] text-gray-400">{ilpEvidence.length} entr{ilpEvidence.length !== 1 ? 'ies' : 'y'}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {ilpEvidence.slice(0, 10).map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                          entry.evidenceType === 'PROGRESS' ? 'bg-green-400' :
                          entry.evidenceType === 'CONCERN'  ? 'bg-rose-400' :
                          'bg-gray-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12px] font-medium text-gray-800 truncate">{entry.homeworkTitle}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              entry.evidenceType === 'PROGRESS' ? 'bg-green-100 text-green-700' :
                              entry.evidenceType === 'CONCERN'  ? 'bg-rose-100 text-rose-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{entry.evidenceType}</span>
                          </div>
                          {entry.aiSummary && (
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{entry.aiSummary}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {entry.subject && ` · ${entry.subject}`}
                            {entry.score != null && ` · ${formatRawScore(entry.score)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.entries(subsByClass).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <Icon name="menu_book" size="sm" className="text-gray-400" />
                    <h2 className="text-[14px] font-semibold text-gray-900">Homework Submissions</h2>
                  </div>
                  {Object.entries(subsByClass).map(([cls, subs]) => {
                    const graded = subs.filter(s => s.status === 'RETURNED')
                    const scores = graded.map(s => s.finalScore).filter(s => s != null) as number[]
                    const avg    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
                    return (
                      <div key={cls} className="border-b border-gray-100 last:border-0">
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
                          <p className="text-[12px] font-semibold text-gray-700">{cls}</p>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <span className="text-[13px] font-bold text-gray-900">{subs.length}</span>
                              <span className="text-[11px] text-gray-400 ml-1">submitted</span>
                            </div>
                            {avg != null && (
                              <div>
                                <span className="text-[13px] font-bold text-blue-600">{avg}</span>
                                <span className="text-[11px] text-gray-400 ml-1">avg</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {subs.slice(0, 5).map(sub => (
                            <div key={sub.id} className="flex items-center gap-3 px-5 py-3">
                              <div className="shrink-0">
                                {sub.status === 'RETURNED'
                                  ? <Icon name="check_circle" size="sm" className="text-green-500" />
                                  : <Icon name="schedule" size="sm" className="text-amber-400" />
                                }
                              </div>
                              <p className="flex-1 text-[12px] text-gray-800 truncate">{sub.homework.title}</p>
                              <div className="shrink-0 flex items-center gap-2">
                                {sub.grade && (
                                  <span className="text-[11px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-lg">{sub.grade}</span>
                                )}
                                {sub.finalScore != null && !sub.grade && (
                                  <span className="text-[11px] font-semibold text-gray-600">{formatRawScore(sub.finalScore)}</span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Right column: summary cards ── */}
            <div className="space-y-4">

              {/* Enrolled classes */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="people" size="sm" className="text-gray-400" />
                  <h3 className="text-[12px] font-semibold text-gray-700">Classes</h3>
                </div>
                {enrolments.length === 0 ? (
                  <p className="text-[12px] text-gray-400">Not enrolled in any classes</p>
                ) : (
                  <div className="space-y-2">
                    {enrolments.map(e => (
                      <div key={e.classId} className="text-[12px]">
                        <p className="font-medium text-gray-800">{e.class.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {e.class.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`).join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan summary */}
              {plan && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-[12px] font-semibold text-gray-700 mb-3">Plan Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-gray-500">Targets</span>
                      <span className="font-semibold text-gray-800">{plan.targets.length}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-gray-500">Achieved</span>
                      <span className="font-semibold text-green-600">{plan.targets.filter(t => t.achieved).length}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-gray-500">Strategies</span>
                      <span className="font-semibold text-gray-800">{plan.strategies.length}</span>
                    </div>
                    {plan.parentSharedAt && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-gray-500">Shared</span>
                        <span className="font-semibold text-green-600">
                          {new Date(plan.parentSharedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Misconceptions */}
              {topMisconceptions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-[12px] font-semibold text-gray-700 mb-3">Recurring Misconceptions</h3>
                  <div className="space-y-2">
                    {topMisconceptions.map(([tag, count]) => (
                      <div key={tag}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[11px] text-gray-700 truncate">{tag}</p>
                          <span className="text-[10px] font-bold text-rose-600 ml-2 shrink-0">{count}×</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-400 rounded-full"
                            style={{ width: `${Math.min(100, (count / topMisconceptions[0][1]) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission stats */}
              {submissions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-[12px] font-semibold text-gray-700 mb-3">Submission Stats</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-gray-500">Total submitted</span>
                      <span className="font-semibold text-gray-800">{submissions.length}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-gray-500">Returned / marked</span>
                      <span className="font-semibold text-green-600">{submissions.filter(s => s.status === 'RETURNED').length}</span>
                    </div>
                    {(() => {
                      const scores = submissions.map(s => s.finalScore).filter(s => s != null) as number[]
                      if (!scores.length) return null
                      return (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-gray-500">Avg score</span>
                          <span className="font-semibold text-blue-600">{Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
