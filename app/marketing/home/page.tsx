import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI-Powered Learning & SEND Platform for UK Schools',
  description: 'Omnis brings lesson planning, adaptive homework, ILP/EHCP management, and MIS sync together in one platform built for UK secondary schools.',
  openGraph: {
    title: 'Omnis Education — AI-Powered Learning & SEND Platform for UK Schools',
    description: 'Omnis brings lesson planning, adaptive homework, ILP/EHCP management, and MIS sync together in one platform built for UK secondary schools.',
    url: 'https://omnis.education/marketing/home',
  },
  alternates: { canonical: 'https://omnis.education/marketing/home' },
}

const features = [
  {
    icon: 'auto_awesome',
    title: 'AI-powered homework',
    desc: 'Generate, auto-mark, and return homework in minutes. Per-student adaptive variants for EHCP and SEN Support pupils built in.',
  },
  {
    icon: 'psychology',
    title: 'SEND intelligence',
    desc: 'ILP, EHCP, and K Plan management in one place. Early-warning flags, evidence linking, and SENCO oversight — all wired together.',
  },
  {
    icon: 'insights',
    title: 'Adaptive analytics',
    desc: 'Per-student learning profiles update automatically after every submission. Bloom\'s taxonomy heatmaps and weak-topic detection for every class.',
  },
  {
    icon: 'calendar_month',
    title: 'Lesson planning',
    desc: 'Weekly calendar with Oak National Academy resource integration. Cover management, timetable sync, and year-group revision programs.',
  },
  {
    icon: 'school',
    title: 'MIS sync via Wonde',
    desc: 'Pull students, staff, classes, and timetables directly from your MIS. GDPR consent managed automatically.',
  },
  {
    icon: 'bar_chart',
    title: 'SLT & HOY dashboards',
    desc: 'RAG attainment views, SEND gap analysis, GCSE benchmarks against national averages, and integrity signals — all role-aware.',
  },
]

const roles = [
  {
    role: 'Teachers',
    color: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-700',
    items: [
      'Lesson calendar with Oak resource search',
      'AI homework generator — MCQ, short answer, extended writing',
      'Auto-marking and per-question feedback',
      'Class roster with SEND badges and ILP goals',
      'Revision programs with student confidence tracking',
    ],
  },
  {
    role: 'SENCO',
    color: 'bg-purple-50 border-purple-100',
    iconColor: 'text-purple-700',
    items: [
      'ILP, EHCP, and K Plan in one view',
      'Automated ILP evidence linking from homework',
      'Early-warning flags: attendance, concern trends, grade drops',
      'AI agent insights — confirm, override, or dismiss',
      'APDR cycle management and review scheduling',
    ],
  },
  {
    role: 'SLT & HOY',
    color: 'bg-teal-50 border-teal-100',
    iconColor: 'text-teal-700',
    items: [
      'School-wide GCSE attainment vs national benchmarks',
      'SEND gap analysis and year-group breakdowns',
      'Cover management and absence tracking',
      'Filterable audit log for compliance',
      'Head of Year pastoral overview per student',
    ],
  },
  {
    role: 'Students & Parents',
    color: 'bg-green-50 border-green-100',
    iconColor: 'text-green-700',
    items: [
      'Student homework list with status and grade history',
      'Revision planner with AI-generated tasks',
      'Per-subject topic heatmaps and format breakdowns',
      'Parent portal with progress view and consent management',
      'Messaging between staff and parents',
    ],
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://omnis.education/#organization',
      name: 'Omnis Education',
      url: 'https://omnis.education',
      logo: 'https://omnis.education/favicon.png',
      description: 'AI-powered learning and SEND management platform for UK secondary schools.',
      contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: 'hello@omnis.education', areaServed: 'GB' },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Omnis Education Platform',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP', description: 'Free during beta period' },
      description: 'AI-powered school platform for UK secondary schools covering lesson planning, adaptive homework, ILP/EHCP management, Wonde MIS sync, and school analytics.',
      featureList: ['AI homework generation', 'SEND/ILP/EHCP management', 'MIS sync via Wonde', 'Adaptive learning profiles', 'GCSE analytics', 'APDR cycle management'],
      audience: { '@type': 'EducationalAudience', educationalRole: 'teacher', geographicArea: 'United Kingdom' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is Omnis?', acceptedAnswer: { '@type': 'Answer', text: 'Omnis is an AI-powered school management platform built specifically for UK secondary schools. It connects lesson planning, adaptive homework generation, SEND/ILP/EHCP management, MIS data sync via Wonde, and school analytics in one integrated platform.' } },
        { '@type': 'Question', name: 'How does Omnis integrate with our MIS?', acceptedAnswer: { '@type': 'Answer', text: 'Omnis integrates directly with your school\'s Management Information System (MIS) via the Wonde API. Once connected, it automatically pulls students, staff, classes, timetables, and attendance data — keeping everything in sync without manual imports.' } },
        { '@type': 'Question', name: 'Which SEND documents does Omnis manage?', acceptedAnswer: { '@type': 'Answer', text: 'Omnis manages Individual Learning Plans (ILPs), Education, Health and Care Plans (EHCPs), K Plans, and APDR (Assess, Plan, Do, Review) cycles. It includes AI-assisted ILP generation, evidence linking from homework, early-warning flags, and SENCO oversight dashboards.' } },
        { '@type': 'Question', name: 'How does the AI homework feature work?', acceptedAnswer: { '@type': 'Answer', text: 'Teachers select a topic, learning objectives, and homework type (multiple choice, short answer, or extended writing). Omnis uses Claude AI to generate a full set of questions with model answers and marking rubrics. For SEND pupils, it automatically produces differentiated variants adapted to each student\'s ILP and EHCP provisions.' } },
        { '@type': 'Question', name: 'Is Omnis GDPR-compliant?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Omnis is designed for UK GDPR compliance. It includes a full consent management system, immutable audit logging of all staff access to student data (including SEND records), DPA acknowledgement gates for staff, GDPR-compliant data retention, and tools for managing data subject requests.' } },
        { '@type': 'Question', name: 'Which schools is Omnis designed for?', acceptedAnswer: { '@type': 'Answer', text: 'Omnis is designed for UK state secondary schools, including academies, free schools, and maintained schools, covering Years 7 to 13. It supports 12 roles including Teacher, SENCO, SLT, Head of Year, Head of Department, Teaching Assistant, and Parent.' } },
        { '@type': 'Question', name: 'How much does Omnis cost?', acceptedAnswer: { '@type': 'Answer', text: 'Omnis is free during our beta programme. Beta schools get full platform access, dedicated onboarding support, and direct input into the product roadmap at no cost. Pricing for the full commercial release will be announced ahead of wider rollout.' } },
        { '@type': 'Question', name: 'How quickly can our school get started?', acceptedAnswer: { '@type': 'Answer', text: 'Most schools are fully set up within a week. After connecting your MIS via Wonde, student and staff data is pulled in automatically. Our onboarding team helps you configure the platform, train staff, and run the first AI homework generation in your first session.' } },
      ],
    },
  ],
}

const faqs = [
  { q: 'What is Omnis?', a: 'Omnis is an AI-powered school platform connecting lesson planning, adaptive homework, SEND/ILP/EHCP management, Wonde MIS sync, and analytics in one place — built for UK secondary schools.' },
  { q: 'How does MIS integration work?', a: 'Omnis connects to your MIS via the Wonde API, automatically pulling students, staff, classes, timetables, and attendance data. No manual CSV imports.' },
  { q: 'Which SEND documents does Omnis manage?', a: 'ILPs, EHCPs, K Plans, and APDR cycles — with AI-assisted generation, homework evidence linking, early-warning flags, and a full SENCO oversight dashboard.' },
  { q: 'How does AI homework generation work?', a: 'Teachers choose a topic and type (MCQ, short answer, extended writing). Claude AI generates questions, model answers, and marking rubrics. SEND pupils automatically receive differentiated variants based on their ILP and EHCP provisions.' },
  { q: 'Is Omnis GDPR-compliant?', a: 'Yes. Omnis includes consent management, immutable SEND audit logging, DPA acknowledgement gates, data retention controls, and tools for managing subject access requests.' },
  { q: 'How much does Omnis cost?', a: 'Free during the beta programme. Beta schools receive full access, dedicated onboarding, and direct input into the roadmap at no cost.' },
]

export default function MarketingHomePage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 text-white px-6 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/15 border border-white/20 text-blue-100 text-xs font-medium px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
            Now in beta — UK secondary schools
          </span>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            The SEND-intelligent<br />school platform
          </h1>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Omnis connects lesson planning, adaptive homework, ILP management, and school analytics in one platform — built around the needs of SEND pupils.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/marketing/beta" className="bg-white text-blue-800 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors text-base">
              Request beta access
            </Link>
            <Link href="/marketing/features" className="border border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-base">
              See all features
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: '12 roles', label: 'Teacher · SENCO · SLT · TA · Parent · Student…' },
            { stat: 'EHCP-aware', label: 'Adapted homework for every SEND status' },
            { stat: 'Wonde sync', label: 'Live MIS data — students, timetables, staff' },
            { stat: 'AI agents', label: 'Nightly COACH · QUALITY · PLAN_SYNTHESIS runs' },
          ].map(({ stat, label }) => (
            <div key={stat}>
              <div className="text-2xl font-bold text-white mb-1">{stat}</div>
              <div className="text-gray-400 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Everything in one place</h2>
        <p className="text-gray-500 text-center max-w-2xl mx-auto mb-14">
          From the first lesson plan to the EHCP annual review — Omnis handles the full school workflow so staff can focus on teaching.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <span className="material-icons text-blue-700 text-3xl mb-4 block">{icon}</span>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Role cards */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Built for every role in your school</h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14">
            Each role gets a tailored experience — only the tools and data they need.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {roles.map(({ role, color, iconColor, items }) => (
              <div key={role} className={`border rounded-2xl p-6 ${color}`}>
                <h3 className={`font-semibold text-lg mb-4 ${iconColor}`}>{role}</h3>
                <ul className="space-y-2">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className={`material-icons text-base mt-0.5 shrink-0 ${iconColor}`}>check_circle</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ section */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Common questions</h2>
        <p className="text-gray-500 text-center mb-12">Everything you need to know before applying for beta access.</p>
        <dl className="space-y-6">
          {faqs.map(({ q, a }) => (
            <div key={q} className="border border-gray-100 rounded-xl p-6">
              <dt className="font-semibold text-gray-900 mb-2">{q}</dt>
              <dd className="text-gray-500 text-sm leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to transform your school&apos;s workflow?</h2>
        <p className="text-gray-500 max-w-xl mx-auto mb-8">
          We&apos;re accepting a small number of UK secondary schools into our beta programme. Places are limited.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/marketing/beta" className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors">
            Apply for beta access
          </Link>
          <Link href="/marketing/investors" className="border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-8 py-3.5 rounded-xl transition-colors">
            Investor enquiries
          </Link>
        </div>
      </section>
    </main>
  )
}
