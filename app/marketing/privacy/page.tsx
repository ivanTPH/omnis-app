export const metadata = {
  title: 'Privacy Policy — Omnis Education',
  description: 'How Omnis Education Ltd collects, uses, and protects your personal data.',
}

const SECTIONS = [
  {
    title: '1. Who we are',
    content: `Omnis Education Ltd ("Omnis", "we", "us") is the data controller for personal data collected through this website and the Omnis platform. We provide a learning and SEND intelligence platform to UK secondary schools.

Contact: privacy@omnis.education
Registered in England and Wales.`,
  },
  {
    title: '2. Data we collect',
    content: `We collect and process the following categories of personal data:

**School staff (teachers, SENCO, SLT, administrators)**
- Name, email address, professional role
- Activity within the platform (lesson plans, homework created, marks entered)
- Login timestamps and audit events

**Students**
- Name, year group, class, school email address
- Homework submissions and grades
- SEND status, ILP/EHCP/K Plan records (where applicable)
- Revision session data and adaptive learning profile
- Attendance data (where synced from MIS)

**Parents and carers**
- Name, email address, relationship to student
- Consent records, messaging thread content

**Website visitors**
- IP address, browser type, pages visited (via server logs only — we do not use third-party analytics trackers without consent)`,
  },
  {
    title: '3. Lawful basis for processing',
    content: `We rely on the following lawful bases under UK GDPR:

- **Contract** — to deliver the platform services agreed with your school under our Terms of Service
- **Legitimate interests** — platform security, fraud prevention, service improvement, and usage analytics that do not override individual rights
- **Legal obligation** — to comply with applicable UK law including the Data Protection Act 2018
- **Consent** — for optional features such as marketing communications and non-essential cookies (you may withdraw consent at any time)

For special category data (SEND information, educational needs), we rely on Article 9(2)(g) UK GDPR — substantial public interest — in conjunction with Schedule 1 of the DPA 2018 (education, training and employment purposes).`,
  },
  {
    title: '4. How we use your data',
    content: `We use personal data to:

- Provide, operate, and improve the Omnis platform
- Authenticate users and maintain platform security
- Generate AI-powered lesson plans, homework, and SEND insights (processed via Anthropic Claude API — see section 6)
- Sync student and staff records from your school MIS via Wonde
- Send transactional emails (homework notifications, ILP review reminders, account activation)
- Maintain an audit trail of significant actions for GDPR and safeguarding compliance
- Detect early-warning patterns that may indicate a student needs support

We do not use student personal data for advertising or sell data to third parties.`,
  },
  {
    title: '5. Data retention',
    content: `We retain personal data for the following periods:

| Category | Retention period |
|---|---|
| Active user accounts | Duration of the school's subscription + 12 months |
| Student SEND records (ILP, EHCP, APDR) | 7 years from the student leaving the school (in line with DfE guidance) |
| Audit logs | 3 years |
| Homework submissions and grades | 3 years from submission |
| TA and teacher notes | 3 years |
| Parent contact logs | 7 years |
| Website enquiry emails | 2 years |

After the retention period, data is securely deleted or anonymised.`,
  },
  {
    title: '6. Third-party processors',
    content: `We share data with the following sub-processors, all subject to data processing agreements:

| Processor | Purpose | Location |
|---|---|---|
| **Supabase** | Database hosting (PostgreSQL) | EU (Frankfurt) |
| **Vercel** | Application hosting and edge CDN | EU / Global |
| **Anthropic** | AI content generation (Claude API) | USA — Standard Contractual Clauses apply |
| **Wonde** | MIS data sync | UK |
| **Resend** | Transactional email delivery | EU |

We do not transfer personal data to countries without an adequacy decision or appropriate safeguards unless stated above.`,
  },
  {
    title: '7. Your rights under UK GDPR',
    content: `You have the following rights:

- **Right of access** — request a copy of the data we hold about you
- **Right to rectification** — ask us to correct inaccurate data
- **Right to erasure** — ask us to delete your data (subject to legal retention obligations)
- **Right to restrict processing** — ask us to pause processing in certain circumstances
- **Right to data portability** — receive your data in a structured, machine-readable format
- **Right to object** — object to processing based on legitimate interests
- **Rights related to automated decision-making** — we do not make solely automated decisions with legal or similarly significant effects

To exercise any right, email privacy@omnis.education. We will respond within 30 days. You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk.`,
  },
  {
    title: '8. Schools as data controllers',
    content: `Schools that use Omnis are independent data controllers for their students' personal data. Omnis acts as a data processor on behalf of the school under a Data Processing Agreement (DPA) included in our Terms of Service.

Schools are responsible for:
- Obtaining appropriate consent or establishing lawful bases for processing student data
- Ensuring students and parents are informed of how their data is used
- Handling data subject requests from their own community
- Ensuring staff use the platform in accordance with their own data protection policies

If you are a student, parent, or staff member with a data request relating to your school's use of Omnis, please contact your school's Data Protection Officer in the first instance.`,
  },
  {
    title: '9. Security',
    content: `We implement appropriate technical and organisational measures to protect personal data, including:

- All data encrypted in transit (TLS 1.2+) and at rest
- Role-based access control — users can only access data appropriate to their role
- All significant actions are audit-logged with timestamp and user identity
- JWT-based authentication with short-lived session tokens
- Regular security reviews and penetration testing (planned)

In the event of a personal data breach that is likely to result in a risk to individuals' rights and freedoms, we will notify the ICO within 72 hours and affected schools without undue delay.`,
  },
  {
    title: '10. Cookies',
    content: `We use the following cookies:

| Cookie | Type | Purpose |
|---|---|---|
| next-auth.session-token | Essential | Authentication session |
| next-auth.csrf-token | Essential | CSRF protection |
| omnis-cookie-consent | Essential | Stores your cookie preference |

We do not currently use analytics or advertising cookies. If we introduce non-essential cookies in future, we will request your consent first.

You can manage cookie preferences via the banner displayed on your first visit, or by clearing your browser cookies.`,
  },
  {
    title: '11. Changes to this policy',
    content: `We may update this Privacy Policy from time to time. Material changes will be notified to school administrators by email at least 30 days before taking effect. The "last updated" date at the top of this page will always reflect the current version.`,
  },
  {
    title: '12. Contact us',
    content: `For any privacy-related query or to exercise your rights:

**Email:** privacy@omnis.education
**Post:** Omnis Education Ltd, Data Protection, [Registered Address]

We aim to respond to all requests within 5 working days.`,
  },
]

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">Legal</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: 12 June 2026 &nbsp;·&nbsp; Applies to: omnis.education and omnis-app-ten.vercel.app</p>
      </div>

      <div className="prose prose-gray max-w-none space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title}>
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
                // Render bullet lists
                if (para.trim().startsWith('- ')) {
                  const items = para.trim().split('\n').filter(l => l.startsWith('- '))
                  return (
                    <ul key={i} className="list-disc list-outside ml-4 space-y-1">
                      {items.map((item, ii) => (
                        <li key={ii} dangerouslySetInnerHTML={{ __html: item.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                      ))}
                    </ul>
                  )
                }
                // Regular paragraphs — bold via **text**
                return (
                  <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
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
