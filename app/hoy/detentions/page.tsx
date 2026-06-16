import { requireAuth }          from '@/lib/session'
import { redirect }             from 'next/navigation'
import AppShell                  from '@/components/AppShell'
import { getDetentionRegister }  from '@/app/actions/detentions'
import DetentionView             from './DetentionView'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

export default async function DetentionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const { year } = await searchParams
  const yearGroup = year ? parseInt(year, 10) : undefined

  const data = await getDetentionRegister(yearGroup)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <DetentionView initialData={data} initialYear={yearGroup} />
    </AppShell>
  )
}
