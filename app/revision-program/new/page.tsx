import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import RevisionProgramCreator from '@/components/revision-program/RevisionProgramCreator'
import { getTeacherClasses } from '@/app/actions/homework'

export default async function NewRevisionProgramPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const allowed = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SLT','SCHOOL_ADMIN','SUPER_ADMIN']
  if (!allowed.includes(role)) redirect('/dashboard')

  const classes = await getTeacherClasses()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b bg-white">
          <h1 className="text-base font-semibold text-gray-900">New Revision Program</h1>
        </div>
        <RevisionProgramCreator classes={classes} />
      </div>
    </AppShell>
  )
}
