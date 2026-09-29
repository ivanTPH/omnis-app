export const metadata = {
  title: 'Privacy Policy — Omnis Education',
  description: 'How Omnis collects, uses and protects personal data.',
}

const SECTIONS = [
  {
    title: '1. Who we are and our role',
    content: `Omnis is a learning and SEND support platform for UK schools, available at omnis.education.

Omnis is operated by Omnis Education, which is being set up as a limited company registered in England and Wales. Company registration details will be added here once registration is complete.

**For school data, the school is in charge.** Each school that uses Omnis is the data controller for its pupils', parents' and staff's personal data. Omnis is a data processor: we only use that data to provide the service, on the school's instructions, under a Data Processing Agreement with the school.

**For our own business data, we are in charge.** Omnis is the data controller only for information about visitors to our website, enquiries sent to us, and our business contacts.

Contact: privacy@omnis.education`,
  },
  {
    title: '2. Data we process',
    content: `**School staff (teachers, SENCOs, senior leaders, administrators)**
- Name, school email address and role
- What they do in the platform (lessons, homework set, marks entered)
- Sign-in times and an audit log of significant actions

**Pupils**
- Name, year group, class and school email address
- Homework, answers and grades
- SEND status and SEND plans (ILP, EHCP, APDR, Learning Passport), where the school records them
- Safeguarding, behaviour and pastoral records, where the school chooses to record them in Omnis
- Revision and learning-profile information
- Attendance and other information copied from the school's management information system (MIS) through Wonde

**Parents and carers**
- Name, email address and relationship to the pupil
- Consent choices and messages with the school

**Website visitors and enquiries**
- Basic server logs (IP address, browser type, pages visited) and anything you send us. We do not use third-party analytics or advertising trackers.`,
  },
  {
    title: '3. Lawful basis',
    content: `**For school data,** the school decides the lawful basis, because it is the controller. Schools usually rely on public task (UK GDPR Article 6(1)(e)) for their education functions, and on substantial public interest (Article 9(2)(g) with Schedule 1 of the Data Protection Act 2018) for SEND and safeguarding information. Your school's own privacy notice explains this.

**For our own business data,** we rely on legitimate interests (running and securing our website and replying to enquiries) and, for any marketing emails, consent, which you can withdraw at any time.`,
  },
  {
    title: '4. How the data is used',
    content: `Omnis uses school data only to provide the service to the school:
- Signing users in and keeping accounts secure
- Setting, completing and marking homework, and tracking progress
- Supporting SEND planning and review, with staff approving anything that matters
- Copying pupil, staff and class information from the school's MIS through Wonde
- Sending service emails (for example homework reminders, sign-in codes, review reminders)
- Keeping an audit log of significant actions

We never sell data, use pupil data for advertising, or use it to train AI models.`,
  },
  {
    title: '5. How we use AI',
    content: `Some features use an AI service, Claude, provided by Anthropic PBC in the USA. It helps draft homework, SEND plans and feedback. A member of staff always reviews AI output before it takes effect; no decision with legal or similarly significant effect is made by AI alone.

**Before any request leaves Omnis, pupil, parent and staff names are replaced with random codes, and email addresses and phone numbers are removed.** The key that links codes to names stays inside Omnis and is never sent. Information about a pupil's learning and needs is still sent where the feature needs it, so this coded information is still treated as personal data.

Under Anthropic's commercial terms, Anthropic does not use this data to train its models and deletes it within 30 days. The transfer to the USA is protected by the UK International Data Transfer Addendum to the EU Standard Contractual Clauses in Anthropic's data processing terms.`,
  },
  {
    title: '6. How long data is kept',
    content: `**School data** is kept for as long as the school instructs. Each school sets its retention schedule in Omnis. The defaults follow the IRMS Academies Toolkit, which the Department for Education's Data Protection Toolkit for Schools relies on:

| Record | Default retention |
|---|---|
| SEND files (ILP, EHCP, APDR, SEND status) | Pupil's date of birth plus 31 years |
| Pupil record, including behaviour and exclusions | Pupil's date of birth plus 25 years |
| Safeguarding and child protection files | Pupil's date of birth plus 25 years, then review |
| Homework, messages, learning profile | Deleted when the school erases a leaver's data |
| Audit logs | 6 years |

When a pupil leaves, the school can download the pupil's SEND and safeguarding file to keep under its own procedures, and Omnis then deletes it. When a school stops using Omnis, we return its data in a usable format and then delete it, including from backups, within the period set out in the Data Processing Agreement.

**Our own business data:** website enquiries are kept for 2 years.`,
  },
  {
    title: '7. Who we share data with',
    content: `We use the following suppliers (sub-processors) to run Omnis. Each is bound by data protection terms:

| Supplier | What it does | Where |
|---|---|---|
| **DigitalOcean** | Runs the Omnis application | London, UK |
| **Supabase** | Database | Frankfurt, Germany |
| **Anthropic** | AI drafting and marking (names replaced with codes) | USA |
| **Sentry** | Error monitoring | Germany |
| **Upstash** | Sign-in codes and rate limiting | Confirmed in the Data Processing Agreement |
| **Resend** | Sends service emails | Confirmed in the Data Processing Agreement |
| **Wonde** | Copies data from the school's MIS | UK |

Schools are told before we add or change a supplier and can object.`,
  },
  {
    title: '8. Your rights',
    content: `Under UK GDPR you can ask to see your data, correct it, delete it, restrict or object to its use, or receive a copy in a portable format.

**If your request is about school data** (you are a pupil, parent or member of staff), contact your school's Data Protection Officer. The school handles the request and we help it.

**If your request is about our own business data,** email privacy@omnis.education. We will acknowledge your request within 5 working days and respond in full within one month.

You can also complain to the Information Commissioner's Office (ico.org.uk).`,
  },
  {
    title: '9. Security',
    content: `We protect data with:
- Encryption in transit (TLS) and at rest
- Compulsory two-step sign-in for all staff accounts
- Role-based access, so each person sees only what their role needs
- Separation between schools, checked in every database request and tested regularly
- An audit log of significant actions
- Error monitoring and a written incident response plan
- Regular internal security reviews and automated security scanning

We have completed a Cyber Essentials self-assessment. We will update this page when independent certification and penetration testing have been completed.

If a personal data breach affects school data, we will tell the school without undue delay and within 24 hours of becoming aware of it, so the school can notify the ICO within 72 hours where required.`,
  },
  {
    title: '10. Cookies',
    content: `We only use cookies that are needed for the service to work:

| Cookie | Type | Purpose |
|---|---|---|
| next-auth.session-token | Essential | Keeps you signed in |
| next-auth.csrf-token | Essential | Protects forms against misuse |
| omnis-cookie-consent | Essential | Remembers your cookie choice |

We do not use analytics or advertising cookies. If that changes, we will ask for your consent first.`,
  },
  {
    title: '11. Changes to this policy',
    content: `We will tell school administrators by email at least 30 days before any significant change. The date at the top of this page shows when it was last updated.`,
  },
  {
    title: '12. Contact',
    content: `**Email:** privacy@omnis.education
**Post:** address to be added once the company is registered.`,
  },
]

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">Legal</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: 29 September 2026 &nbsp;·&nbsp; Applies to: omnis.education</p>
      </div>

      <div className="prose prose-gray max-w-none space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title} id={s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')} className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{s.title}</h2>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line text-sm space-y-3">
              {s.content.split('\n\n').map((para, i) => {
                // Render table-like blocks as preformatted
                if (para.includes('|---|')) {
                  const rows = para.trim().split('\n')
                  return (
                    <div key={i} className="overflow-x-auto">
                      <table className="min-w-full text-xs border-collapse border border-gray-200 rounded">
                        <tbody>
                          {rows.filter(r => !r.match(/^\|[-| ]+\|$/)).map((row, ri) => {
                            const cells = row.split('|').filter(c => c.trim() !== '')
                            const isHeader = ri === 0
                            return (
                              <tr key={ri} className={isHeader ? 'bg-gray-50' : 'border-t border-gray-100'}>
                                {cells.map((cell, ci) => isHeader ? (
                                  <th key={ci} className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">{cell.trim().replace(/\*\*/g, '')}</th>
                                ) : (
                                  <td key={ci} className="px-3 py-2 text-gray-600 border-r border-gray-200 last:border-r-0">{cell.trim().replace(/\*\*/g, '')}</td>
                                ))}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
                const bold = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                const lines = para.trim().split('\n')
                const items = lines.filter(l => l.startsWith('- '))
                const intro = lines.filter(l => !l.startsWith('- '))
                // Bullet lists, optionally with an intro line or heading above them
                if (items.length > 0) {
                  return (
                    <div key={i}>
                      {intro.length > 0 && (
                        <p className="mb-1" dangerouslySetInnerHTML={{ __html: intro.map(bold).join('<br/>') }} />
                      )}
                      <ul className="list-disc list-outside ml-4 space-y-1">
                        {items.map((item, ii) => (
                          <li key={ii} dangerouslySetInnerHTML={{ __html: bold(item.slice(2)) }} />
                        ))}
                      </ul>
                    </div>
                  )
                }
                // Regular paragraphs — bold via **text**, single line breaks kept
                return (
                  <p key={i} dangerouslySetInnerHTML={{ __html: lines.map(bold).join('<br/>') }} />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 text-sm text-gray-400">
        Questions about this policy? Email{' '}
        <a href="mailto:privacy@omnis.education" className="text-blue-600 hover:underline">
          privacy@omnis.education
        </a>
      </div>
    </main>
  )
}
