import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getMyChildrenConsents } from '@/app/actions/gdpr'
import ParentConsentPortal from '@/components/gdpr/ParentConsentPortal'

export default async function ParentConsentPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'PARENT') redirect('/dashboard')

  const children = await getMyChildrenConsents(schoolId)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-bold text-gray-900">Consent Settings</h1>
                <p className="text-[13px] text-gray-400 mt-0.5">
                  Manage how the school uses your child&apos;s personal data
                </p>
              </div>
              <a
                href="/parent/messages"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-[13px] font-medium hover:bg-blue-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Message teacher
              </a>
            </div>
          </div>
          <ParentConsentPortal children={children} />
        </div>
      </main>
    </AppShell>
  )
}
