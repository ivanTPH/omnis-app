import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAllIlps, getStudentsWithSendButNoIlp } from '@/app/actions/send-support'
import AppShell from '@/components/AppShell'
import IlpPageView from '@/components/send-support/IlpPageView'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function IlpPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const [ilps, studentsWithoutIlp] = await Promise.all([
    getAllIlps(),
    getStudentsWithSendButNoIlp(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader title="Individual Learning Plans" subtitle="Active ILPs and drafts pending SENCO review" />
        </div>
        <div className="px-6 pb-6">
          <IlpPageView ilps={ilps} studentsWithoutIlp={studentsWithoutIlp} />
        </div>
      </div>
    </AppShell>
  )
}
