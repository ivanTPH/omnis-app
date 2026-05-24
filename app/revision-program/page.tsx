import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import RevisionProgramListPage from '@/components/revision-program/RevisionProgramListPage'
import { getRevisionPrograms } from '@/app/actions/revision-program'

export default async function RevisionProgramPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const allowed = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SLT','SCHOOL_ADMIN','SUPER_ADMIN']
  if (!allowed.includes(role)) redirect('/dashboard')

  const programs = await getRevisionPrograms()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <RevisionProgramListPage programs={programs} />
    </AppShell>
  )
}
