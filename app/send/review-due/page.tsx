import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus } from '@prisma/client'
import type { Plan, SendStatus, User } from '@prisma/client'

type SendStatusWithStudent = SendStatus & { student: Pick<User, 'id' | 'firstName' | 'lastName' | 'yearGroup'> }

function PlanRow({ plan, ssById, now, in7 }: {
  plan: Plan
  ssById: Record<string, SendStatusWithStudent>
  now: Date
  in7: Date
}) {
  const ss  = ssById[plan.studentId]
  const rd  = new Date(plan.reviewDate)
  const ago = Math.ceil((now.getTime() - rd.getTime()) / 86_400_000)
  const left = Math.ceil((rd.getTime() - now.getTime()) / 86_400_000)
  return (
    <Link href={`/send/ilp/${plan.studentId}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition group"
    >
      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <span className="text-blue-700 font-bold text-[11px]">{ss?.student.firstName[0]}{ss?.student.lastName[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900">{ss?.student.firstName} {ss?.student.lastName}</p>
        <p className="text-[11px] text-gray-400">
          Year {ss?.student.yearGroup ?? '—'}
          {ss?.needArea && <span className="ml-2 text-blue-600">{ss.needArea}</span>}
        </p>
      </div>
      <span className={`shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
        plan.status === PlanStatus.ACTIVE_PARENT_SHARED ? 'bg-green-100 text-green-700' : 'bg-teal-50 text-teal-700'
      }`}>
        {plan.status === PlanStatus.ACTIVE_PARENT_SHARED ? 'Shared w/ Parent' : 'Active (Internal)'}
      </span>
      <div className="shrink-0 text-right w-36">
        <p className={`text-[13px] font-bold ${rd < now ? 'text-red-600' : rd <= in7 ? 'text-amber-600' : 'text-gray-600'}`}>
          {rd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-[10px] text-gray-400">
          {rd < now ? `${ago} day${ago !== 1 ? 's' : ''} overdue` : `${left} day${left !== 1 ? 's' : ''} left`}
        </p>
      </div>
      <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0 group-hover:text-blue-400 transition" />
    </Link>
  )
}

function Section({ icon, title, colour, items, ssById, now, in7 }: {
  icon: React.ReactNode
  title: string
  colour: string
  items: Plan[]
  ssById: Record<string, SendStatusWithStudent>
  now: Date
  in7: Date
}) {
  if (items.length === 0) return null
  return (
    <div className={`border rounded-xl overflow-hidden mb-5 ${colour}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-inherit">
        {icon}
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-white bg-opacity-60">{items.length}</span>
      </div>
      <div className="bg-white divide-y divide-gray-100">
        {items.map(p => <PlanRow key={p.id} plan={p} ssById={ssById} now={now} in7={in7} />)}
      </div>
    </div>
  )
}

export default async function ReviewDuePage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SCHOOL_ADMIN', 'SLT', 'HEAD_OF_YEAR'].includes(role)) redirect('/dashboard')

  const now  = new Date()
  const in7  = new Date(now.getTime() +  7 * 86_400_000)
  const in30 = new Date(now.getTime() + 30 * 86_400_000)

  // Plans with review date in the next 30 days (or already overdue)
  const plans = await prisma.plan.findMany({
    where: {
      schoolId,
      status: { in: [PlanStatus.ACTIVE_INTERNAL, PlanStatus.ACTIVE_PARENT_SHARED] },
      reviewDate: { lte: in30 },
    },
    orderBy: { reviewDate: 'asc' },
  })

  const studentIds = plans.map(p => p.studentId)

  const sendStatuses = await prisma.sendStatus.findMany({
    where: { studentId: { in: studentIds } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
    },
  })
  const ssById = Object.fromEntries(sendStatuses.map(s => [s.studentId, s]))

  const overdue = plans.filter(p => new Date(p.reviewDate) <  now)
  const urgent  = plans.filter(p => new Date(p.reviewDate) >= now && new Date(p.reviewDate) <= in7)
  const soon    = plans.filter(p => new Date(p.reviewDate) >  in7 && new Date(p.reviewDate) <= in30)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center gap-3 mb-8">
            <Link href="/send/dashboard" className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
              <Icon name="chevron_left" size="sm" />
            </Link>
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Reviews Due</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {plans.length} plan{plans.length !== 1 ? 's' : ''} requiring review within 30 days
              </p>
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-gray-400">
              <Icon name="check_circle" size="lg" className="mx-auto mb-3 text-green-400 opacity-60" />
              <p className="text-[14px] font-medium text-green-700">All plans are up to date</p>
              <p className="text-[12px] mt-1">No reviews due in the next 30 days</p>
            </div>
          ) : (
            <>
              <Section
                icon={<Icon name="warning" size="sm" className="text-red-600" />}
                title="Overdue"
                colour="border-red-200 bg-red-50"
                items={overdue}
                ssById={ssById}
                now={now}
                in7={in7}
              />
              <Section
                icon={<Icon name="warning" size="sm" className="text-amber-600" />}
                title="Due Within 7 Days"
                colour="border-amber-200 bg-amber-50"
                items={urgent}
                ssById={ssById}
                now={now}
                in7={in7}
              />
              <Section
                icon={<Icon name="schedule" size="sm" className="text-gray-500" />}
                title="Due Within 30 Days"
                colour="border-gray-200 bg-white"
                items={soon}
                ssById={ssById}
                now={now}
                in7={in7}
              />
            </>
          )}

        </div>
      </main>
    </AppShell>
  )
}
