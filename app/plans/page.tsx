import { auth }       from '@/lib/auth'
import { redirect }   from 'next/navigation'
import AppShell       from '@/components/AppShell'
import PlansView      from '@/components/PlansView'
import { getPlansData } from '@/app/actions/plans'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']

export default async function PlansPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { id: userId, role, firstName, lastName, schoolName, schoolId } = session.user as {
    id: string; role: string; firstName: string; lastName: string; schoolName: string; schoolId: string
  }

  if (!ALLOWED.includes(role)) redirect('/dashboard')

  let data = { ilps: [], ehcps: [], kplans: [], sencoId: null } as Awaited<ReturnType<typeof getPlansData>>
  try {
    data = await getPlansData()
  } catch (err) {
    console.error('[PlansPage] fetch failed:', err)
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <PlansView
        ilps={data.ilps}
        ehcps={data.ehcps}
        kplans={data.kplans}
        sencoId={data.sencoId}
        role={role}
      />
    </AppShell>
  )
}
