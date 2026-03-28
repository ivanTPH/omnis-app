import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus } from '@prisma/client'

export default async function IlpListPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SCHOOL_ADMIN', 'SLT', 'HEAD_OF_YEAR'].includes(role)) redirect('/dashboard')

  const sendStatuses = await prisma.sendStatus.findMany({
    where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
    },
    orderBy: [{ student: { lastName: 'asc' } }],
  })

  const studentIds = sendStatuses.map(s => s.studentId)

  const plans = await prisma.plan.findMany({
    where: { schoolId, studentId: { in: studentIds } },
    include: { targets: true, strategies: true },
    orderBy: { updatedAt: 'desc' },
  })
  const planByStudent = Object.fromEntries(plans.map(p => [p.studentId, p]))
  const ssById        = Object.fromEntries(sendStatuses.map(s => [s.studentId, s]))

  const statusLabel: Record<string, string> = {
    [PlanStatus.DRAFT]:                'Draft',
    [PlanStatus.ACTIVE_INTERNAL]:      'Active',
    [PlanStatus.ACTIVE_PARENT_SHARED]: 'Shared w/ Parent',
    [PlanStatus.ARCHIVED]:             'Archived',
  }
  const statusStyle: Record<string, string> = {
    [PlanStatus.DRAFT]:                'bg-gray-100 text-gray-500',
    [PlanStatus.ACTIVE_INTERNAL]:      'bg-teal-50 text-teal-700',
    [PlanStatus.ACTIVE_PARENT_SHARED]: 'bg-green-100 text-green-700',
    [PlanStatus.ARCHIVED]:             'bg-gray-100 text-gray-400',
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center gap-3 mb-8">
            <Link href="/send/dashboard" className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
              <Icon name="chevron_left" size="sm" />
            </Link>
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">ILP Records</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{sendStatuses.length} student{sendStatuses.length !== 1 ? 's' : ''} on the SEND register</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {sendStatuses.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Icon name="favorite" size="lg" className="mx-auto mb-3 opacity-30" />
                <p className="text-[14px] font-medium">No ILP records yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sendStatuses.map(ss => {
                  const plan = planByStudent[ss.studentId]
                  return (
                    <Link key={ss.studentId} href={`/send/ilp/${ss.studentId}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition group"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        ss.activeStatus === 'EHCP' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        <span className={`font-bold text-[11px] ${
                          ss.activeStatus === 'EHCP' ? 'text-purple-700' : 'text-blue-700'
                        }`}>{ss.student.firstName[0]}{ss.student.lastName[0]}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900">{ss.student.firstName} {ss.student.lastName}</p>
                        <p className="text-[11px] text-gray-400">
                          Year {ss.student.yearGroup ?? '—'}
                          {ss.needArea && <span className="ml-2 text-blue-600">{ss.needArea}</span>}
                        </p>
                      </div>

                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        ss.activeStatus === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ss.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                      </span>

                      {plan ? (
                        <>
                          <div className="shrink-0 text-right">
                            <p className="text-[12px] text-gray-500">{plan.targets.length} target{plan.targets.length !== 1 ? 's' : ''}</p>
                            <p className="text-[11px] text-gray-400">{plan.strategies.length} strateg{plan.strategies.length !== 1 ? 'ies' : 'y'}</p>
                          </div>
                          <span className={`shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusStyle[plan.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {statusLabel[plan.status] ?? plan.status}
                          </span>
                          <div className="shrink-0 text-right w-24">
                            <p className="text-[11px] text-gray-500">
                              {new Date(plan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-gray-400">Review</p>
                          </div>
                        </>
                      ) : (
                        <span className="shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-400">No Plan</span>
                      )}

                      <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0 group-hover:text-blue-400 transition" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </AppShell>
  )
}
