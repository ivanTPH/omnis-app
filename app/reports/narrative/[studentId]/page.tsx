import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import NarrativeReportView from '@/components/reports/NarrativeReportView'
import { getReportSourceData } from '@/app/actions/reports'

const ALLOWED_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export const dynamic = 'force-dynamic'

export default async function NarrativeReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard')

  const { studentId } = await params

  let source
  try {
    source = await getReportSourceData(studentId)
  } catch {
    redirect(`/students/${studentId}`)
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <PageHeader
            title={`Report — ${source.studentName}`}
            subtitle="AI-drafted narrative from this student's grades, attendance, and learning plan. Review and edit before exporting — nothing is sent to a parent automatically."
            backHref={`/students/${studentId}`}
            backLabel="Student record"
          />
          <NarrativeReportView source={source} />
        </div>
      </main>
    </AppShell>
  )
}
