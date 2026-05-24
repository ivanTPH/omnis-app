import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import YearRevisionCreator from '@/components/revision-program/YearRevisionCreator'
import { getTeacherSubjectsYearGroups } from '@/app/actions/revision-program'

export default async function YearRevisionPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const allowed = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SLT','SCHOOL_ADMIN','SUPER_ADMIN']
  if (!allowed.includes(role)) redirect('/dashboard')

  const subjectsYearGroups = await getTeacherSubjectsYearGroups()

  if (subjectsYearGroups.length === 0) redirect('/revision-program')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <YearRevisionCreator subjectsYearGroups={subjectsYearGroups} />
    </AppShell>
  )
}
