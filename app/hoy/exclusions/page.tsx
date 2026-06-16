import { requireAuth }        from '@/lib/session'
import { redirect }           from 'next/navigation'
import AppShell               from '@/components/AppShell'
import { getExclusionLog }    from '@/app/actions/exclusions'
import ExclusionView          from './ExclusionView'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT', 'SENCO']

export default async function ExclusionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const { year } = await searchParams
  const yearGroup = year ? parseInt(year, 10) : undefined

  const data = await getExclusionLog(yearGroup)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <ExclusionView initialData={data} initialYear={yearGroup} />
    </AppShell>
  )
}
