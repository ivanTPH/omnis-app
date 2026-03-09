import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getPurposes, getConsentMatrix, getDataSubjectRequests } from '@/app/actions/gdpr'
import GdprAdminShell from '@/components/gdpr/GdprAdminShell'

export default async function AdminGdprPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const [purposes, matrix, dsrs] = await Promise.all([
    getPurposes(schoolId),
    getConsentMatrix(schoolId),
    getDataSubjectRequests(schoolId),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-gray-900">GDPR &amp; Consent Management</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Configure consent purposes, review the consent matrix and manage data subject requests
            </p>
          </div>
          <GdprAdminShell
            schoolId={schoolId}
            purposes={purposes}
            matrixPurposes={matrix.purposes}
            students={matrix.students}
            dsrs={dsrs}
          />
        </div>
      </main>
    </AppShell>
  )
}
