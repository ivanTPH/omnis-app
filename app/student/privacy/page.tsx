import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'
import { getDpoContact, getMyParentShareStatus } from '@/app/actions/student'

export const dynamic = 'force-dynamic'

/** ICO Children's Code Standard 15 — a simple, always-reachable "how your
 *  data is used, and who to ask" page for students. Linked from the sidebar
 *  footer (every page) and from the first-login transparency notice. */
export default async function StudentPrivacyPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'STUDENT') redirect('/dashboard')

  const [dpo, shareStatus] = await Promise.all([
    getDpoContact(),
    getMyParentShareStatus(),
  ])

  const hasDpo = !!(dpo.dpoName || dpo.dpoEmail)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center gap-2 mb-1">
            <Link href="/student/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Dashboard
            </Link>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-1">How your data is used</h1>
          <p className="text-[13px] text-gray-400 mb-6">In plain language, and who to ask if you have questions</p>

          <div className="space-y-4">

            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="folder_shared" size="sm" className="text-indigo-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">What Omnis stores about you</h2>
              </div>
              <ul className="text-[13px] text-gray-600 space-y-1.5 list-disc pl-5">
                <li>Your name, year group and class</li>
                <li>Homework you&apos;ve been set, and what you submit</li>
                <li>Grades, feedback, and how you&apos;re progressing over time</li>
                <li>If your school has flagged you for extra support (SEND), your support plan</li>
              </ul>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="visibility" size="sm" className="text-indigo-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">Who can see it</h2>
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Your teachers and relevant school staff (like your Head of Year or SENCO, if you have a
                support plan) can see your homework, grades and progress. Other students never see your
                work or grades.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                {shareStatus.hasLinkedParent
                  ? 'Your parent or carer also has an account and can see your homework and grades — you’ll see a "Visible to your parent" note wherever that applies.'
                  : 'No parent or carer account is currently linked to yours, so nothing is being shared with a parent/carer through Omnis.'}
              </p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="auto_awesome" size="sm" className="text-indigo-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">AI features</h2>
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Some homework and feedback is created with AI assistance. A teacher always checks AI
                suggestions before they count — nothing an AI produces is final without a member of
                staff reviewing it first.
              </p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="help" size="sm" className="text-indigo-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">Who to ask</h2>
              </div>
              {hasDpo ? (
                <div className="text-[13px] text-gray-700">
                  <p>
                    If you have a question about your data, or want to see what {dpo.schoolName} holds
                    about you, ask a trusted adult to contact:
                  </p>
                  <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                    {dpo.dpoName && <p className="font-medium text-indigo-900">{dpo.dpoName}</p>}
                    {dpo.dpoEmail && (
                      <a href={`mailto:${dpo.dpoEmail}`} className="text-indigo-700 hover:underline">
                        {dpo.dpoEmail}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  If you have a question about your data, ask a trusted adult to contact {dpo.schoolName}&apos;s
                  school office and ask for the Data Protection Officer.
                </p>
              )}
            </section>

          </div>
        </div>
      </main>
    </AppShell>
  )
}
