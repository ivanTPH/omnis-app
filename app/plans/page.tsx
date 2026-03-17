import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import PlansView from '@/components/PlansView'
import { prisma } from '@/lib/prisma'

async function getPlans(schoolId: string) {
  const plans = await prisma.plan.findMany({
    where:   { schoolId, status: { not: 'ARCHIVED' } },
    include: {
      student:  { select: { id: true, firstName: true, lastName: true } },
      targets:  { select: { id: true, needCategory: true, metricKey: true }, take: 3 },
    },
    orderBy: { reviewDate: 'asc' },
  })
  return plans
}

export default async function PlansPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName, schoolId } = session.user as any

  let plans: Awaited<ReturnType<typeof getPlans>> = []
  try {
    plans = await getPlans(schoolId)
  } catch (err) {
    console.error('[PlansPage] fetch failed:', err)
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <PlansView plans={plans} role={role} />
    </AppShell>
  )
}
