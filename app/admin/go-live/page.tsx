import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'
import { getGoLiveStatus } from '@/lib/go-live'
import GoLiveButton from '@/components/admin/GoLiveButton'

export const dynamic = 'force-dynamic'

export default async function GoLivePage() {
  const { role, firstName, lastName, schoolName, schoolId } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')
  const status = await getGoLiveStatus(schoolId)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-[22px] font-bold text-gray-900">Go-live checklist</h1>
        <p className="text-[13px] text-gray-500 mt-0.5 mb-6">
          Complete the essential steps, then press Go live. Until then staff can sign in and prepare, but no pupil or parent
          is invited and nobody receives an email from Omnis except staff you invite.
        </p>

        {status.live ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-[13px] text-green-900">
            <p className="font-semibold">Your school is live{status.goLiveAt ? ` (since ${status.goLiveAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})` : ''}.</p>
            <p>Next: tell families about Omnis, then send invitations from the <Link href="/admin/invitations" className="underline">Invitations</Link> page.</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-[13px] text-amber-900">
            {status.requiredDone} of {status.requiredTotal} essential steps done.
          </div>
        )}

        {(['Essential', 'Recommended'] as const).map(group => (
          <section key={group} className="mb-8">
            <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-wide mb-3">{group}</h2>
            <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {status.items.filter(i => i.required === (group === 'Essential')).map(i => (
                <li key={i.key} className="p-4 flex gap-3">
                  <Icon name={i.done ? 'check_circle' : 'radio_button_unchecked'} size="md" className={i.done ? 'text-green-600' : 'text-gray-300'} />
                  <div className="flex-1 text-[13px]">
                    <p className="font-semibold text-gray-900">{i.label}</p>
                    <p className="text-gray-600">{i.detail}</p>
                    <p className="text-gray-400 mt-0.5">Usually done by: {i.who}</p>
                  </div>
                  {!i.done && <Link href={i.href} className="self-center text-[12px] font-medium text-blue-700 hover:underline whitespace-nowrap">Open</Link>}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!status.live && <GoLiveButton ready={status.readyToGoLive} />}
      </div>
    </AppShell>
  )
}
