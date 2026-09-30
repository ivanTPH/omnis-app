import Link from 'next/link'

export const metadata = {
  title: 'Getting started and help — Omnis Education',
  description: 'How pupils, parents and staff get started with Omnis, and answers to common sign-in problems.',
}

const START: { who: string; steps: string[] }[] = [
  {
    who: 'Pupils',
    steps: [
      'Your school will tell you when Omnis is ready. Then an email arrives at your school email address with the subject “Your … Omnis account is ready”.',
      'Click “Set up my account” and choose a password (at least 8 characters).',
      'Sign in at omnis.education/login with your school email address and that password.',
      'You’ll see your homework, your teachers’ feedback and revision activities.',
    ],
  },
  {
    who: 'Parents and carers',
    steps: [
      'Your child’s school will let you know when parent accounts are open, usually by letter or email.',
      'Go to omnis.education/parents and enter the email address the school holds for you.',
      'Open the email we send you and click “Set up my account” to choose a password.',
      'Sign in to see your child’s homework and progress, and to message their teachers. If you have more than one child at the school, you’ll see all of them.',
    ],
  },
  {
    who: 'School staff',
    steps: [
      'Your school admin sends you an invitation email. Click the link and choose a password.',
      'Each time you sign in, you’ll also be asked for a 6-digit code that we email to you. This keeps pupil information safe.',
      'Read and accept the short data protection notice the first time you sign in.',
      'Use Help (in the menu) for step-by-step guides for your role.',
    ],
  },
]

const FAQS: { q: string; a: string }[] = [
  { q: 'I haven’t received my email.', a: 'Check your junk or spam folder, and search for “Omnis”. Pupils: the email goes to your school email address, not a personal one. Parents: it goes to the address the school holds for you. If it still hasn’t arrived after 15 minutes, contact the school office.' },
  { q: 'My link has expired or doesn’t work.', a: 'Set-up links work for 7 days and can only be used once. Go to omnis.education/forgot-password and enter your email address to get a new link. Parents can also simply register again at omnis.education/parents.' },
  { q: 'I’ve forgotten my password.', a: 'Go to omnis.education/forgot-password and enter your email address. We’ll send a link to choose a new password. The link works for one hour.' },
  { q: 'I’m a parent and it says my email isn’t recognised, or nothing arrives.', a: 'For your child’s safety, we can only create a parent account for the email address the school holds on its records, and only for adults with parental responsibility. Ask the school office to check or update your email address, then try again the next day.' },
  { q: 'I can’t see one of my children.', a: 'Your children are linked using the school’s records. If one is missing, the school may hold a different email address for you on that child’s record. Ask the school office to check.' },
  { q: 'I’m a member of staff and haven’t received my 6-digit code.', a: 'Check your junk folder. You can ask for a new code after a minute. If codes still don’t arrive, your school’s email filter may be blocking notifications@omnis.education: ask IT to allow it.' },
  { q: 'Omnis says my school is still setting up.', a: 'Your school is finishing its set-up. Staff can sign in and prepare, but pupil and parent invitations are sent once the school is ready.' },
  { q: 'Who can see my information?', a: 'Pupils see only their own work. Parents see only their own children. Teachers see the pupils they teach. Our privacy policy and the “How your data is used” page inside Omnis explain this in full.' },
  { q: 'Who do I contact for help?', a: 'Pupils and parents: contact your school first; they know your account and can resend invitations. Schools: email support@omnis.education.' },
]

export default function HelpPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">Help</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Getting started with Omnis</h1>
        <p className="text-gray-600">How to set up your account, and answers to the most common problems.</p>
      </div>

      <div className="space-y-12 text-sm text-gray-600 leading-relaxed">
        {START.map(s => (
          <section key={s.who} id={s.who.toLowerCase().split(' ')[0]}>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{s.who}</h2>
            <ol className="list-decimal pl-5 space-y-2">
              {s.steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </section>
        ))}

        <section id="common-problems">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Common problems</h2>
          <div className="space-y-5">
            {FAQS.map(f => (
              <div key={f.q}>
                <h3 className="font-semibold text-gray-900">{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-200 pt-8 flex flex-wrap gap-4">
          <Link href="/login" className="text-blue-700 hover:underline">Sign in</Link>
          <Link href="/marketing/parents" className="text-blue-700 hover:underline">Parent registration</Link>
          <Link href="/forgot-password" className="text-blue-700 hover:underline">Forgotten password</Link>
          <Link href="/marketing/privacy" className="text-blue-700 hover:underline">Privacy policy</Link>
        </section>
      </div>
    </main>
  )
}
