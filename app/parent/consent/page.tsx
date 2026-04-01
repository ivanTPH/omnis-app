import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getMyChildrenConsents } from '@/app/actions/gdpr'
import ParentConsentPortal from '@/components/gdpr/ParentConsentPortal'
import Icon from '@/components/ui/Icon'

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
                <Icon name="chat" size="sm" />
                Message teacher
              </a>
            </div>
          </div>
          <ParentConsentPortal consents={children} />
        </div>
      </main>
    </AppShell>
  )
}
