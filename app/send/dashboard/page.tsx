import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus } from '@prisma/client'

export default async function SendDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SCHOOL_ADMIN', 'SLT', 'HEAD_OF_YEAR'].includes(role)) redirect('/dashboard')

  const now   = new Date()
  const in7   = new Date(now.getTime() +  7 * 86_400_000)
  const in14  = new Date(now.getTime() + 14 * 86_400_000)
  const in30  = new Date(now.getTime() + 30 * 86_400_000)

  // All students on the register
  const sendStatuses = await prisma.sendStatus.findMany({
    where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
    },
    orderBy: [{ activeStatus: 'asc' }, { student: { lastName: 'asc' } }],
  })

  const studentIds = sendStatuses.map(s => s.studentId)

  // Active / draft plans
  const plans = await prisma.plan.findMany({
    where: {
      schoolId,
      studentId: { in: studentIds },
      status: { notIn: [PlanStatus.ARCHIVED] },
    },
    orderBy: { reviewDate: 'asc' },
  })
  const planByStudent = Object.fromEntries(plans.map(p => [p.studentId, p]))

  // Pending status reviews
  const pendingReviews = await prisma.sendStatusReview.count({
    where: { student: { schoolId }, status: 'PENDING' },
  })

  const senSupport  = sendStatuses.filter(s => s.activeStatus === 'SEN_SUPPORT').length
  const ehcp        = sendStatuses.filter(s => s.activeStatus === 'EHCP').length
  const reviewsDue  = plans.filter(p => new Date(p.reviewDate) <= in30).length

  // Bucketed alerts
  const urgent  = plans.filter(p => new Date(p.reviewDate) <= in14)
  const warning = plans.filter(p => new Date(p.reviewDate) > in14 && new Date(p.reviewDate) <= in30)
  const ssById  = Object.fromEntries(sendStatuses.map(s => [s.studentId, s]))

  function AlertRow({ plan, colour }: { plan: typeof plans[0]; colour: 'red' | 'amber' }) {
    const ss = ssById[plan.studentId]
    const c  = colour === 'red'
      ? { bg: 'hover:bg-red-50 border-red-100', chip: 'text-red-600', icon: 'text-red-300 group-hover:text-red-500', avatar: 'bg-red-100 text-red-700' }
      : { bg: 'hover:bg-amber-50 border-amber-100', chip: 'text-amber-600', icon: 'text-amber-300 group-hover:text-amber-500', avatar: 'bg-amber-100 text-amber-700' }
    return (
      <Link href={`/send/ilp/${plan.studentId}`}
        className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 transition border group ${c.bg}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${c.avatar}`}>
            <span className="font-bold text-[11px]">{ss?.student.firstName[0]}{ss?.student.lastName[0]}</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">{ss?.student.firstName} {ss?.student.lastName}</p>
            <p className="text-[11px] text-gray-400">{ss?.needArea} · Year {ss?.student.yearGroup}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[12px] font-semibold ${c.chip}`}>
            Review {new Date(plan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <Icon name="chevron_right" size="sm" className={`transition ${c.icon}`} />
        </div>
      </Link>
    )
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">SEND & Inclusion</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">School-wide register and plan oversight</p>
            </div>
            {pendingReviews > 0 && (
              <Link href="/send/review-due" className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white text-[12px] font-semibold rounded-xl hover:bg-amber-600 transition">
                <Icon name="warning" size="sm" />
                {pendingReviews} pending review{pendingReviews !== 1 ? 's' : ''}
              </Link>
            )}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[28px] font-bold text-gray-900">{sendStatuses.length}</p>
              <p className="text-[12px] text-gray-400 mt-1">On Register</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[28px] font-bold text-blue-600">{senSupport}</p>
              <p className="text-[12px] text-gray-400 mt-1">SEN Support</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[28px] font-bold text-purple-600">{ehcp}</p>
              <p className="text-[12px] text-gray-400 mt-1">EHCP</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className={`text-[28px] font-bold ${reviewsDue > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{reviewsDue}</p>
              <p className="text-[12px] text-gray-400 mt-1">Reviews Due (30d)</p>
            </div>
          </div>

          {/* Alerts */}
          {(urgent.length > 0 || warning.length > 0) && (
            <div className="mb-6 space-y-4">
              {urgent.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="warning" size="sm" className="text-red-600" />
                    <h2 className="text-[12px] font-bold text-red-900 uppercase tracking-wide">Overdue or Due Within 14 Days</h2>
                  </div>
                  <div className="space-y-2">
                    {urgent.map(p => <AlertRow key={p.id} plan={p} colour="red" />)}
                  </div>
                </div>
              )}
              {warning.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="schedule" size="sm" className="text-amber-600" />
                    <h2 className="text-[12px] font-bold text-amber-900 uppercase tracking-wide">Due Within 30 Days</h2>
                  </div>
                  <div className="space-y-2">
                    {warning.map(p => <AlertRow key={p.id} plan={p} colour="amber" />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Register table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icon name="people" size="sm" className="text-gray-400" />
                <h2 className="text-[14px] font-semibold text-gray-900">SEND Register</h2>
                <span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{sendStatuses.length}</span>
              </div>
              <Link href="/send/ilp" className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                All ILP records <Icon name="chevron_right" size="sm" />
              </Link>
            </div>

            {sendStatuses.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Icon name="favorite" size="lg" className="mx-auto mb-3 opacity-30" />
                <p className="text-[14px] font-medium">No students on the SEND register</p>
                <p className="text-[12px] mt-1">Students are added when a SEND status is assigned</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sendStatuses.map(ss => {
                  const plan           = planByStudent[ss.studentId]
                  const reviewDate     = plan ? new Date(plan.reviewDate) : null
                  const reviewUrgent   = reviewDate ? reviewDate <= in7  : false
                  const reviewWarning  = reviewDate ? reviewDate <= in30 : false

                  return (
                    <Link key={ss.studentId} href={`/send/ilp/${ss.studentId}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition group"
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        ss.activeStatus === 'EHCP' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        <span className={`font-bold text-[11px] ${
                          ss.activeStatus === 'EHCP' ? 'text-purple-700' : 'text-blue-700'
                        }`}>{ss.student.firstName[0]}{ss.student.lastName[0]}</span>
                      </div>

                      {/* Name + need area */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900">{ss.student.firstName} {ss.student.lastName}</p>
                        <p className="text-[11px] text-gray-400">
                          Year {ss.student.yearGroup ?? '—'}
                          {ss.needArea && <span className="ml-2 text-blue-600">{ss.needArea}</span>}
                        </p>
                      </div>

                      {/* SEND status */}
                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        ss.activeStatus === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ss.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                      </span>

                      {/* Plan status */}
                      <span className={`shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                        !plan
                          ? 'bg-gray-100 text-gray-400'
                          : plan.status === PlanStatus.ACTIVE_PARENT_SHARED
                            ? 'bg-green-100 text-green-700'
                            : plan.status === PlanStatus.ACTIVE_INTERNAL
                              ? 'bg-teal-50 text-teal-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}>
                        {!plan
                          ? 'No Plan'
                          : plan.status === PlanStatus.ACTIVE_PARENT_SHARED
                            ? 'Shared w/ Parent'
                            : plan.status === PlanStatus.ACTIVE_INTERNAL
                              ? 'Active Plan'
                              : 'Draft Plan'}
                      </span>

                      {/* Review date */}
                      <div className="shrink-0 w-28 text-right">
                        {reviewDate ? (
                          <>
                            <p className={`text-[12px] font-semibold ${
                              reviewUrgent ? 'text-red-600' : reviewWarning ? 'text-amber-600' : 'text-gray-500'
                            }`}>
                              {reviewDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-gray-400">Review due</p>
                          </>
                        ) : (
                          <p className="text-[11px] text-gray-300">—</p>
                        )}
                      </div>

                      <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0 group-hover:text-blue-400 transition" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom quick-links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/send/ilp" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-blue-300 hover:shadow-sm transition group">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="description" size="sm" className="text-blue-600" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">ILP Records</p>
                <p className="text-[11px] text-gray-400">All learning plans</p>
              </div>
            </Link>
            <Link href="/send/review-due" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-amber-300 hover:shadow-sm transition group">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="schedule" size="sm" className="text-amber-600" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Review Due</p>
                <p className="text-[11px] text-gray-400">{reviewsDue} plan{reviewsDue !== 1 ? 's' : ''} to review</p>
              </div>
            </Link>
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5 opacity-60">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="check_circle" size="sm" className="text-gray-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-500">Adaptations</p>
                <p className="text-[11px] text-gray-400">Coming soon</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
