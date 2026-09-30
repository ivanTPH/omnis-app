import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import { getInvitationOverview } from '@/app/actions/go-live'
import InvitationsPanel from '@/components/admin/InvitationsPanel'

export const dynamic = 'force-dynamic'

export default async function InvitationsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')
  const overview = await getInvitationOverview()
  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-[22px] font-bold text-gray-900">Invitations</h1>
        <p className="text-[13px] text-gray-500 mt-0.5 mb-6">
          Omnis never emails pupils or parents on its own. You choose when, and which year groups. We suggest telling
          families about Omnis first (letter templates are in the onboarding pack), then sending invitations a day or two later.
        </p>
        <InvitationsPanel overview={overview} />
      </div>
    </AppShell>
  )
}
