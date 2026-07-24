import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTrialStatus } from '@/app/actions/trial'
import Icon from '@/components/ui/Icon'

export const metadata = { title: 'Upgrade — Omnis' }

const FEATURES = [
  { icon: 'school', label: 'Full class roster & SEND tracking' },
  { icon: 'assignment', label: 'Unlimited homework with AI auto-marking' },
  { icon: 'psychology', label: 'AI-generated ILPs, APDR cycles & EHCP support' },
  { icon: 'analytics', label: 'SLT, HOD, HOY & SENCO analytics dashboards' },
  { icon: 'sync', label: 'MIS sync via Wonde (live timetable & student data)' },
  { icon: 'email', label: 'Parent & student email notifications' },
  { icon: 'security', label: 'UK GDPR Article 9 compliance & audit logs' },
  { icon: 'support_agent', label: 'Priority support & onboarding' },
]

export default async function UpgradePage() {
  const session = await auth()
  const trial   = await getTrialStatus()

  const firstName = (session?.user as any)?.firstName ?? 'there'
  const expired   = trial !== null && !trial.active
  const daysLeft  = trial?.active ? trial.daysLeft : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-start py-16 px-4">

      {/* Header */}
      <div className="text-center max-w-xl mb-12">
        {expired ? (
          <>
            <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <Icon name="lock" size="sm" />
              Trial ended
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Hi {firstName}, your trial has ended
            </h1>
            <p className="text-gray-500 text-lg">
              Upgrade to a full Omnis subscription to keep your data, your students, and everything you&apos;ve set up.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <Icon name="timer" size="sm" />
              {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Upgrade before your trial ends
            </h1>
            <p className="text-gray-500 text-lg">
              Keep your school&apos;s data, your student records, and all the work you&apos;ve done — no re-setup required.
            </p>
          </>
        )}
      </div>

      {/* Feature list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-lg mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">Everything included</p>
        <ul className="space-y-3">
          {FEATURES.map(f => (
            <li key={f.label} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                <Icon name={f.icon} size="sm" color="text-indigo-500" />
              </span>
              <span className="text-sm text-gray-700">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="w-full max-w-lg space-y-3">
        <a
          href="mailto:ivanyardley@me.com?subject=Omnis%20subscription%20enquiry"
          className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
        >
          <Icon name="mail" size="sm" />
          Contact us to subscribe
        </a>
        <p className="text-center text-xs text-gray-400">
          We&apos;ll set up your school&apos;s account and migrate your demo data.
        </p>
      </div>

      {/* Back link — only show if trial still active */}
      {!expired && (
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      )}

    </div>
  )
}
