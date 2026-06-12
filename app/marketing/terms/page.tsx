export const metadata = {
  title: 'Terms of Service — Omnis Education',
  description: 'Terms governing your use of the Omnis platform and website.',
}

const SECTIONS = [
  {
    title: '1. Parties and agreement',
    content: `These Terms of Service ("Terms") form a legally binding agreement between **Omnis Education Ltd** ("Omnis", "we", "us") and the school, trust, or local authority ("School") that subscribes to the Omnis platform.

By completing our onboarding form, accepting an invitation, or using the platform, the School agrees to these Terms on behalf of its authorised staff. Individual users (teachers, SENCO, administrators) use the platform under authority granted by their School.

If you do not agree to these Terms, do not use the platform.`,
  },
  {
    title: '2. The service',
    content: `Omnis provides a cloud-based learning and SEND intelligence platform including:

- AI-powered lesson planning, homework generation, and auto-marking
- SEND management (ILP, EHCP, K Plan, APDR, early-warning flags)
- MIS sync via Wonde for student, staff, and class data
- Analytics and reporting dashboards for teachers, SENCO, SLT, and administrators
- Messaging, notifications, and parent engagement tools

We may update, improve, or modify features at any time. We will give reasonable notice of any material reduction in functionality.`,
  },
  {
    title: '3. Subscription and payment',
    content: `**Trial period**
Schools may access a free trial period as agreed at sign-up. During the trial, all features are available. No payment is required during the trial.

**Paid subscription**
Following the trial, continued access requires a paid subscription. Pricing is agreed in a separate Order Form or quotation. Invoices are issued annually in advance unless otherwise agreed.

**Payment terms**
Invoices are due within 30 days of issue. Overdue accounts may result in suspension of access after reasonable notice.

**Cancellation**
Either party may cancel with 30 days' written notice prior to the renewal date. No refunds are issued for unused portions of a paid period.`,
  },
  {
    title: '4. School responsibilities',
    content: `The School is responsible for:

- Ensuring all staff who access the platform are authorised to do so
- Informing students, parents, and staff of how their data is used in accordance with the School's own privacy notice
- Complying with the UK GDPR, the Data Protection Act 2018, and all applicable safeguarding legislation
- Obtaining any consents required from parents or carers before processing student personal data on the platform
- Maintaining the confidentiality of account credentials
- Promptly notifying Omnis of any suspected unauthorised access or security incident
- Ensuring that student SEND data entered into the platform is accurate and kept up to date`,
  },
  {
    title: '5. Acceptable use',
    content: `Users must not:

- Use the platform for any unlawful purpose or in violation of any applicable regulation
- Attempt to access data belonging to another school or user
- Upload or transmit malicious code, viruses, or harmful content
- Use the AI features to generate content that is discriminatory, harmful, or in breach of safeguarding duties
- Attempt to reverse-engineer, copy, or resell any part of the platform
- Share login credentials between multiple individuals

We reserve the right to suspend or terminate access immediately in the event of a serious breach of these terms.`,
  },
  {
    title: '6. Data processing',
    content: `**Roles**
The School is the data controller for all personal data relating to its students, staff, and parents. Omnis acts as a data processor on behalf of the School, processing data only on the School's documented instructions.

**Data Processing Agreement**
By accepting these Terms, the School also accepts Omnis's Data Processing Agreement (DPA), which forms part of this agreement. The DPA sets out the subject matter, duration, nature and purpose of processing, the type of personal data, and the categories of data subjects.

**Omnis's obligations as processor**
Omnis will:
- Process personal data only on the School's instructions
- Ensure staff with access to personal data are bound by confidentiality obligations
- Implement appropriate technical and organisational security measures
- Assist the School in meeting its obligations under UK GDPR (e.g., data subject requests, breach notifications)
- Delete or return all personal data on termination of the agreement, as instructed by the School
- Not engage sub-processors without the School's general or specific authorisation (a list of current sub-processors is maintained in our Privacy Policy)`,
  },
  {
    title: '7. Intellectual property',
    content: `**Omnis IP**
The Omnis platform, including its source code, design, AI models, and documentation, is the exclusive property of Omnis Education Ltd. These Terms grant the School a limited, non-exclusive, non-transferable licence to use the platform during the subscription period.

**School content**
Lesson plans, homework content, SEND records, and other materials created by School staff using the platform remain the property of the School. Omnis does not claim ownership of any content you create.

**AI-generated content**
Content generated by the AI features (homework questions, ILP goals, revision tasks) is provided for the School's use. Schools should apply professional judgement before relying on AI-generated content in formal contexts.`,
  },
  {
    title: '8. Availability and support',
    content: `**Target availability**
We target 99.5% monthly uptime excluding planned maintenance. Planned maintenance will be notified with at least 48 hours' notice and will be scheduled outside core school hours (07:00–18:00 UK time, Monday–Friday, term-time) where possible.

**Support**
Support is available by email at support@omnis.education. We aim to acknowledge all support requests within 1 business day and resolve critical issues within 2 business days.

**No guarantee**
The platform is provided "as is". While we take all reasonable steps to ensure reliability, we do not guarantee uninterrupted access or that all features will operate error-free at all times.`,
  },
  {
    title: '9. Limitation of liability',
    content: `To the maximum extent permitted by law:

- Omnis's total liability to the School for any claim arising under or in connection with these Terms is limited to the fees paid by the School in the 12 months preceding the claim
- Omnis is not liable for any indirect, consequential, or special damages, including loss of profits, loss of data, or reputational damage
- Nothing in these Terms excludes liability for death or personal injury caused by negligence, fraud, or any other liability that cannot lawfully be excluded

Schools remain solely responsible for decisions made using information or content from the platform, including any AI-generated content.`,
  },
  {
    title: '10. Termination',
    content: `Either party may terminate this agreement:

- On 30 days' written notice to the other party prior to the renewal date
- Immediately if the other party commits a material breach and (where the breach is capable of remedy) fails to remedy it within 14 days of written notice
- Immediately if the other party becomes insolvent, enters administration, or ceases to trade

On termination, the School's access to the platform will be suspended. The School may request an export of its data within 30 days of termination, after which data will be securely deleted in accordance with our retention schedule.`,
  },
  {
    title: '11. Changes to these Terms',
    content: `We may update these Terms from time to time. We will notify Schools of material changes by email at least 30 days before they take effect. Continued use of the platform after that date constitutes acceptance of the updated Terms.

If a School does not accept the updated Terms, it may terminate the agreement by notifying us before the effective date.`,
  },
  {
    title: '12. Governing law and disputes',
    content: `These Terms are governed by the laws of England and Wales. Any dispute arising from or in connection with these Terms will be subject to the exclusive jurisdiction of the courts of England and Wales.

We are committed to resolving disputes informally wherever possible. Please contact us at legal@omnis.education before initiating any formal proceedings.`,
  },
  {
    title: '13. Contact',
    content: `**Omnis Education Ltd**
Email: legal@omnis.education
For data protection matters: privacy@omnis.education
For support: support@omnis.education`,
  },
]

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">Legal</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: 12 June 2026 &nbsp;·&nbsp; Effective for all subscriptions from 12 June 2026</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 mb-10 text-sm text-amber-800">
        <strong>For schools:</strong> By using the Omnis platform, your school agrees to these Terms, including the Data Processing Agreement in section 6. Please share this document with your Data Protection Officer before onboarding.
      </div>

      <div className="prose prose-gray max-w-none space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{s.title}</h2>
            <div className="text-gray-600 leading-relaxed text-sm space-y-3">
              {s.content.split('\n\n').map((para, i) => {
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
                // Sub-heading lines (bold text on own line)
                if (para.trim().startsWith('**') && para.trim().endsWith('**') && !para.includes('\n')) {
                  return <p key={i} className="font-semibold text-gray-800">{para.replace(/\*\*/g, '')}</p>
                }
                return (
                  <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 text-sm text-gray-400">
        Questions about these Terms? Email{' '}
        <a href="mailto:legal@omnis.education" className="text-blue-600 hover:underline">
          legal@omnis.education
        </a>
      </div>
    </main>
  )
}
