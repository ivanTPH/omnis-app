import Link from 'next/link'

export const metadata = {
  title: 'Security and data protection — Omnis Education',
  description: 'How Omnis protects pupil, parent and staff data: hosting, suppliers, AI safeguards, access control, retention and breach response.',
}

const SUPPLIERS: { name: string; purpose: string; location: string }[] = [
  { name: 'DigitalOcean', purpose: 'Runs the Omnis application', location: 'London, UK' },
  { name: 'Supabase', purpose: 'Database, encrypted at rest', location: 'Frankfurt, Germany' },
  { name: 'Anthropic', purpose: 'AI drafting and marking. Names are replaced with codes before anything is sent', location: 'USA (UK Addendum to the EU Standard Contractual Clauses)' },
  { name: 'Sentry', purpose: 'Error monitoring', location: 'Germany' },
  { name: 'Upstash', purpose: 'Sign-in codes and rate limiting (short-lived data)', location: 'Being confirmed' },
  { name: 'Resend', purpose: 'Sends service emails', location: 'Being confirmed' },
  { name: 'Wonde', purpose: 'Copies data from the school’s management information system', location: 'UK' },
]

const MEASURES: { title: string; body: string }[] = [
  { title: 'Signing in', body: 'Two-step sign-in (a 6-digit code by email) is compulsory for all staff. Passwords are stored only as secure hashes, sign-in attempts are rate-limited, and staff are signed out after 15 minutes without activity.' },
  { title: 'Access by role', body: 'Every page and action checks the user’s role. Pupils and parents cannot see SEND plans or other pupils’ information.' },
  { title: 'Separation between schools', body: 'Every database request is limited to the user’s own school. This is checked in regular internal audits and live tests.' },
  { title: 'Encryption', body: 'All traffic uses HTTPS with strict transport security. The database is encrypted at rest.' },
  { title: 'AI safeguards', body: 'Before any request leaves Omnis, pupil, parent and staff names are replaced with random codes, and email addresses and phone numbers are removed. The key never leaves Omnis, and nothing is sent if the check fails. Staff review everything the AI suggests before it takes effect. The AI provider does not train on this data and deletes it within 30 days.' },
  { title: 'Logging and monitoring', body: 'Significant actions, including views of SEND records, are recorded in an audit log. Errors are monitored with alerts to a named person.' },
  { title: 'Secure development', body: 'Automated code and dependency scanning, type checking, unit tests and over 450 automated end-to-end tests.' },
  { title: 'Children’s Code', body: 'Omnis has been assessed against all 15 standards of the ICO Age Appropriate Design Code, including privacy-friendly default settings and a plain-language page for pupils.' },
]

export default function SecurityPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">Trust</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Security and data protection</h1>
        <p className="text-gray-500 text-sm">Last updated: 29 September 2026</p>
      </div>

      <div className="space-y-10 text-sm text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Our role</h2>
          <p>
            Each school using Omnis is the data controller for its pupils’, parents’ and staff’s data. Omnis is the data
            processor: we use that data only to provide the service, on the school’s instructions, under a Data Processing
            Agreement. We never sell data or use it to train AI models. Full details are in our{' '}
            <Link href="/marketing/privacy" className="text-blue-700 hover:underline">privacy policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How we protect data</h2>
          <div className="space-y-4">
            {MEASURES.map(m => (
              <div key={m.title}>
                <h3 className="font-semibold text-gray-900">{m.title}</h3>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="suppliers">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Where data is stored: our suppliers</h2>
          <p className="mb-3">These suppliers (sub-processors) help us run Omnis. Each is bound by data protection terms. Schools are told before we add or change a supplier.</p>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">Supplier</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">What it does</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">Location</th>
                </tr>
              </thead>
              <tbody>
                {SUPPLIERS.map(s => (
                  <tr key={s.name} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-3 py-2">{s.purpose}</td>
                    <td className="px-3 py-2">{s.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How long data is kept</h2>
          <p>
            Each school sets its own retention schedule in Omnis. The defaults follow the IRMS Academies Toolkit: SEND files
            until the pupil’s date of birth plus 31 years, and the pupil record and safeguarding files until date of birth
            plus 25 years. When a pupil leaves, the school downloads the pupil’s file before Omnis deletes it. When a school
            stops using Omnis, we return its data and then delete it, including from backups, within 90 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">If something goes wrong</h2>
          <p>
            We have a written incident response plan. If a personal data breach affects a school’s data, we tell the school
            without undue delay and within 24 hours of becoming aware of it, so the school can meet its 72-hour deadline to
            notify the Information Commissioner’s Office.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Independent assurance</h2>
          <p>
            We have completed a Cyber Essentials self-assessment. Cyber Essentials Plus certification and an independent
            penetration test are planned, and we will update this page when they are complete.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Documents for schools and trusts</h2>
          <p className="mb-2">On request, we provide:</p>
          <ul className="list-disc list-outside ml-4 space-y-1">
            <li>supplier information to support your Data Protection Impact Assessment (DPIA)</li>
            <li>our own DPIA and risk register</li>
            <li>our Data Processing Agreement</li>
            <li>a summary of our incident response plan</li>
          </ul>
          <p className="mt-3">
            Email <a href="mailto:privacy@omnis.education" className="text-blue-700 hover:underline">privacy@omnis.education</a>.
            Our <Link href="/marketing/terms" className="text-blue-700 hover:underline">terms of service</Link> are also published.
          </p>
        </section>
      </div>
    </main>
  )
}
