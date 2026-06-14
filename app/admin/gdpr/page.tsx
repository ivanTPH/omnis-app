import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getPurposes, getConsentMatrix, getDataSubjectRequests, getStudentsForDsr } from '@/app/actions/gdpr'
import GdprAdminShell from '@/components/gdpr/GdprAdminShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function AdminGdprPage() {
  const { schoolId, role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const [purposes, matrix, dsrs, studentOptions] = await Promise.all([
    getPurposes(schoolId),
    getConsentMatrix(schoolId),
    getDataSubjectRequests(schoolId),
    getStudentsForDsr(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">GDPR &amp; Consent Management</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                Configure consent purposes, review the consent matrix and manage data subject requests
              </p>
            </div>
            <Link
              href="/api/export/gdpr-audit"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shrink-0"
            >
              <Icon name="download" size="sm" />
              Consent Audit CSV
            </Link>
          </div>
          <GdprAdminShell
            schoolId={schoolId}
            purposes={purposes}
            matrixPurposes={matrix.purposes}
            students={matrix.students}
            dsrs={dsrs}
            studentOptions={studentOptions}
          />
        </div>
      </main>
    </AppShell>
  )
}
