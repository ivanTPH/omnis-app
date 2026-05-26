'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step  = string
type FAQ   = { q: string; a: string }
type Section = {
  id:      string
  title:   string
  icon:    string
  intro:   string
  steps:   { heading: string; steps: Step[] }[]
  faqs:    FAQ[]
  links?:  { label: string; href: string }[]
}

// ── Content ───────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id:    'getting-started',
    title: 'Getting Started',
    icon:  'rocket_launch',
    intro: 'Omnis is your all-in-one platform for lesson planning, homework, SEND support, and analytics. Here is everything you need to get up and running in your first week.',
    steps: [
      {
        heading: 'Navigating Omnis',
        steps: [
          'The left sidebar shows your role-specific navigation links. Click any item to go to that section.',
          'The Dashboard (/dashboard) is your home page — it shows today\'s lessons, homework to mark, and any open concerns.',
          'Use the student search bar at the top of the sidebar to jump directly to any student\'s profile.',
          'Click your name/avatar at the bottom-left to access Settings, where you can upload a photo and set your professional preferences.',
          'The bell icon in the sidebar takes you to Notifications — check here for SEND alerts, grade confirmations, and system messages.',
        ],
      },
      {
        heading: 'Setting up your profile',
        steps: [
          'Go to Settings (bottom-left of sidebar).',
          'Upload a profile photo under the Profile tab (JPG or PNG, max 5 MB).',
          'Under Professional, set your default subject and year groups — this pre-fills many forms across the platform.',
          'Under Accessibility, choose font size, contrast, and dyslexia-friendly font options.',
        ],
      },
    ],
    faqs: [
      { q: 'I cannot see a page listed in the sidebar — why?', a: 'Some pages are role-restricted. If you believe you should have access, contact your School Admin to check your role assignment.' },
      { q: 'How do I change my password?', a: 'Go to Settings → Password tab. Enter your current password and your new password twice, then click Save.' },
      { q: 'The page looks different to what I expect — why?', a: 'Omnis is continuously updated. If something has changed, check the Notifications page for update announcements or use the Guide chat (bottom-right) for help.' },
    ],
    links: [
      { label: 'Go to Dashboard', href: '/dashboard' },
      { label: 'Go to Settings',  href: '/settings' },
    ],
  },
  {
    id:    'homework',
    title: 'Homework & Marking',
    icon:  'assignment',
    intro: 'Homework in Omnis covers the full workflow: create → students submit → auto-mark or manually mark → return with feedback.',
    steps: [
      {
        heading: 'Creating a homework',
        steps: [
          'Go to Homework in the sidebar and click + New Homework (top-right).',
          'Step 1: Select a lesson or class. The homework creator will inherit the subject and year group.',
          'Step 2: Choose a type — Multiple Choice Quiz, Short Answer, Extended Writing, Mixed, or Upload.',
          'Step 3: Add questions manually, or click Generate from Resources to have AI create questions from your lesson resources.',
          'Step 4: Set grading bands — these define how raw scores map to GCSE grades 1–9. The default is out of 9.',
          'Step 5: Set a due date and click Publish. Students are notified automatically.',
        ],
      },
      {
        heading: 'Marking a submission',
        steps: [
          'Go to Homework and click on a piece of homework that has submissions.',
          'The left panel lists all students with colour-coded grade pills. Click a student to open their submission on the right.',
          'For MCQ homeworks, auto-mark is available — click Auto-mark All to score all submissions instantly.',
          'For written work, review the student\'s answer, enter a score (1–9), and optionally add teacher feedback.',
          'Click Save & Next to move to the next student. When finished, click Return All to send grades back to students.',
          'If a student has an active ILP, a blue banner will appear after marking — click it to record ILP evidence.',
        ],
      },
      {
        heading: 'Grading bands explained',
        steps: [
          'Grading bands define what raw score corresponds to each GCSE grade (1–9).',
          'For example, a homework out of 9 might use bands: 9=Grade 9, 8=Grade 8, 7=Grade 7, etc.',
          'If you use a homework out of 20, set bands accordingly: "18-20"=Grade 9, "16-17"=Grade 8, etc.',
          'The system automatically converts raw scores to 0–100 percentages and then to GCSE grades using your bands.',
          'If no bands are set, the system defaults to out-of-9 scoring.',
        ],
      },
    ],
    faqs: [
      { q: 'A student says they submitted but I cannot see it — why?', a: 'Check the submission status filter at the top of the marking panel. Switch from "Submitted" to "All" to see all students including those who have not yet submitted.' },
      { q: 'Can I edit a homework after publishing?', a: 'You can edit the due date and feedback. Questions cannot be edited after students have submitted to preserve submission integrity.' },
      { q: 'What is the difference between Save and Return?', a: 'Save records the grade in the system but does not notify the student. Return sends the grade and feedback to the student — they will see it on their homework dashboard.' },
      { q: 'Can I set homework for individual students?', a: 'Currently homework is set per class. For individual SEND adaptations, the AI generator can create differentiated versions of questions. Use the SEND Adaptations checkboxes in the homework creator.' },
    ],
    links: [
      { label: 'Go to Homework', href: '/homework' },
    ],
  },
  {
    id:    'analytics',
    title: 'Analytics & RAG Grades',
    icon:  'bar_chart',
    intro: 'The Analytics section gives you a live view of class and student performance. The RAG (Red / Amber / Green) system compares each student\'s current working-at grade against their predicted grade.',
    steps: [
      {
        heading: 'Reading the RAG dashboard',
        steps: [
          'Go to Analytics and select a class from the Classes tab.',
          'The RAG tab shows every student with a coloured status dot: Green = on track, Amber = 1 grade below predicted, Red = 2+ grades below predicted.',
          'The "Working at" column shows the average percentage across all marked homework this term, converted to a GCSE grade.',
          'The "Predicted" column shows the teacher\'s predicted grade (or the student\'s baseline / passport grade as a fallback).',
          'Click any student row to open a detailed panel with a grade trend sparkline, ILP targets, and recent homework.',
        ],
      },
      {
        heading: 'Setting a predicted grade',
        steps: [
          'In the RAG tab, click the pencil icon (edit) at the end of a student row.',
          'Enter a Predicted Score (0–100) and an optional Adjustment (+/−) to account for exceptional circumstances.',
          'The Effective score is automatically calculated as Predicted + Adjustment.',
          'Add a note in the commentary field and click Save draft to record without formally signing off.',
          'Click Confirm grade → to formally sign off the prediction — this creates an audit trail and notifies all Heads of Department.',
          'You must add commentary before you can confirm a grade.',
        ],
      },
      {
        heading: 'Understanding grade sources',
        steps: [
          'The "Predicted" column uses the best available source in this order: (1) Teacher Prediction, (2) Student Baseline (e.g. CAT score), (3) Learning Passport predicted grade.',
          'If none of these are set, the student shows "No data" and a grey RAG status.',
          'To set a baseline score for a student, go to their student profile via the student search or the Classes roster.',
        ],
      },
    ],
    faqs: [
      { q: 'Why is a student showing "No data" in the RAG view?', a: 'The student has no teacher prediction, no baseline score, and no passport predicted grade. Set a teacher prediction using the pencil icon in the RAG table.' },
      { q: 'The working-at grade seems wrong — why?', a: 'Working-at is the average percentage across all marked homework this term, converted to a GCSE grade. If few homeworks have been marked, it may not be representative.' },
      { q: 'What is a confirmed grade vs a draft prediction?', a: 'A draft prediction is your working estimate. A confirmed grade is a formal sign-off that creates an audit trail and notifies HODs — use this at the end of a term or reporting cycle.' },
      { q: 'Can I filter the RAG view?', a: 'Yes — click the coloured chips at the top (On Track, Developing, Needs Support) to filter the student list to that RAG category.' },
    ],
    links: [
      { label: 'Go to Analytics', href: '/analytics' },
    ],
  },
  {
    id:    'send',
    title: 'SEND Support',
    icon:  'favorite',
    intro: 'Omnis helps SENCOs and teachers manage the full SEND workflow: concerns → ILP targets → EHCPs → early warnings → interventions. All records create an audit trail.',
    steps: [
      {
        heading: 'Raising a SEND concern',
        steps: [
          'Go to SENCO → Concerns (or use the student search to find the student and open their SEND record).',
          'Click + New Concern and fill in the concern type, description, and severity.',
          'The SENCO will be notified automatically and the concern will appear on the SENCO dashboard.',
          'Concerns feed into the early warning engine — multiple concerns for the same student can trigger an Early Warning Flag automatically.',
        ],
      },
      {
        heading: 'Managing ILP records',
        steps: [
          'Go to SENCO → ILP Records to see all active Individual Learning Plans.',
          'Click + Generate ILP to have AI draft SMART targets for a student based on their profile. You must review and approve the draft.',
          'Each ILP has targets with status: Active, Achieved, Not Achieved, or Deferred.',
          'After marking homework, Omnis can automatically suggest linking that submission to an ILP target. Look for the blue banner after marking.',
          'The ILP evidence timeline (/senco/ilp-evidence) shows a log of all linked evidence across the school.',
        ],
      },
      {
        heading: 'Approving an EHCP',
        steps: [
          'When AI generates an EHCP draft, it starts with "Awaiting review" status — it is not yet active.',
          'Go to SENCO → EHCP Plans and find the plan marked "Awaiting review".',
          'Read through the AI-generated draft carefully. Add your SENCO review commentary in the text box.',
          'Click Approve & Activate EHCP to formally sign off the plan and make it active.',
          'Once active, the EHCP provisions are visible to all teachers on the student\'s class roster.',
        ],
      },
      {
        heading: 'Responding to early warning flags',
        steps: [
          'Go to SENCO → Early Warning to see all open flags.',
          'Each flag shows the student, flag type (e.g. Score Decline, Missed Homeworks), severity, and description.',
          'Click Take Action to open the action panel. Choose an action type: Notify Teachers, Schedule SENCO Meeting, Refer for External Support, or Monitor.',
          'If you choose Notify Teachers, write the specific intervention you want them to take — this text is sent directly to class teachers in their notification.',
          'Click Mark as actioned to close the flag and send notifications.',
          'Teachers who receive an early warning notification can log their intervention response directly from their Notifications page.',
        ],
      },
    ],
    faqs: [
      { q: 'How do early warning flags get created?', a: 'Flags are generated automatically by a daily check (runs weekday mornings). The system looks for: completion drop (homework submission rate falling), score decline (average grade dropping), pattern absence (3+ missed homeworks), and multiple concerns logged.' },
      { q: 'Can teachers see EHCP content?', a: 'Teachers can see EHCP provisions on the student\'s class roster (the SEND sidebar in the homework marking panel). The full EHCP document is visible to SENCO, SLT, and School Admin.' },
      { q: 'What is the difference between a concern and an early warning?', a: 'A concern is manually raised by a teacher or SENCO. An early warning is automatically generated by Omnis when it detects a pattern across homework data — it is a system alert, not a manual entry.' },
      { q: 'How do I link homework evidence to an ILP target?', a: 'After marking a submission, Omnis shows a blue banner if the student has an active ILP. Click Yes and Omnis will use AI to classify each target as PROGRESS, CONCERN, or NEUTRAL based on the submission. Confirm and save.' },
    ],
    links: [
      { label: 'SENCO Dashboard',  href: '/senco/dashboard'      },
      { label: 'Early Warning',    href: '/senco/early-warning'  },
      { label: 'ILP Records',      href: '/senco/ilp'            },
      { label: 'EHCP Plans',       href: '/senco/ehcp'           },
    ],
  },
  {
    id:    'revision',
    title: 'Revision Programs',
    icon:  'menu_book',
    intro: 'Teachers can create AI-powered revision programs for their classes. Students complete tasks independently and can also use their own revision planner.',
    steps: [
      {
        heading: 'Creating a revision program (teacher)',
        steps: [
          'Go to Revision in the sidebar and click + New Program.',
          'Step 1: Choose a class — the system will load their subject, year group, and scheme of work.',
          'Step 2: Select a term. Omnis will analyse the class\'s homework performance and identify topic gaps.',
          'Step 3: Review the topic coverage. Green topics are well covered; amber topics are gaps in the scheme of work.',
          'Step 4: Add or remove topics from the revision list, then click Generate Tasks.',
          'Omnis generates a structured set of revision tasks with explanations, practice questions, and model answers. This is sent to all enrolled students.',
        ],
      },
      {
        heading: 'Using the student revision planner',
        steps: [
          'Students go to Revision Planner in their sidebar.',
          'They can add their own exams with a subject and date — Omnis generates a personalised revision timetable.',
          'Each revision session has study notes, practice questions with model answers, and a confidence rating (1–5 stars).',
          'Completed sessions show a progress bar and confidence trend over time.',
          'The Test Mode option lets students test themselves on each topic without seeing the answers first.',
        ],
      },
    ],
    faqs: [
      { q: 'How many revision programs can I create per class?', a: 'There is a rate limit of 3 programs per class per week to prevent overloading students with tasks.' },
      { q: 'Can I edit the tasks after generating them?', a: 'Tasks are generated from the topic list you select. If you need different content, delete the program and create a new one with adjusted topics.' },
      { q: 'Students say they cannot see the revision tasks — why?', a: 'Check that the program status is not in Draft. The program must be published for students to see their tasks.' },
    ],
    links: [
      { label: 'Revision Programs', href: '/revision-program' },
    ],
  },
  {
    id:    'messaging',
    title: 'Messaging & Notifications',
    icon:  'chat',
    intro: 'Omnis has two communication channels: direct Messages (like email threads) and Notifications (system alerts for SEND, grades, and homework).',
    steps: [
      {
        heading: 'Sending a message',
        steps: [
          'Go to Messages in the sidebar.',
          'Click + New Thread and search for the person you want to message (staff, students, or parents).',
          'Type your message and press Enter or click Send.',
          'New messages show a blue unread badge in the sidebar. Open the thread to mark as read.',
          'Message threads are persistent — all replies stay in the same thread.',
        ],
      },
      {
        heading: 'Managing notifications',
        steps: [
          'Go to Notifications in the sidebar to see all system alerts.',
          'Each notification has a type badge (e.g. Early Warning, Grade Confirmed, Homework Reminder).',
          'Click the external link icon to jump to the related page (e.g. the student\'s SEND record).',
          'For Early Warning notifications, click "Log intervention taken" to expand a text field where you can record the intervention you have completed. This is sent back to the SENCO.',
          'Click Mark read or Mark all read to clear the unread count in the sidebar.',
        ],
      },
    ],
    faqs: [
      { q: 'I received an Early Warning notification — what should I do?', a: 'Read the SENCO\'s recommended intervention in the notification body. Click "Log intervention taken" to expand the form, describe what you did, and click Log. This notifies the SENCO that you have acted.' },
      { q: 'Can parents message teachers?', a: 'Parents can message through their parent portal. Staff can reply from the Messages section. Some schools restrict parent messaging — check with your School Admin.' },
      { q: 'How do I stop receiving certain notifications?', a: 'Notification preferences can be managed in Settings → Privacy. Note that safeguarding-related SEND alerts cannot be disabled.' },
    ],
    links: [
      { label: 'Messages',      href: '/messages'      },
      { label: 'Notifications', href: '/notifications' },
    ],
  },
]

// ── Accordion item ─────────────────────────────────────────────────────────────

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Icon name={section.icon} size="sm" className="text-blue-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{section.title}</p>
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-6 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed">{section.intro}</p>

          {/* Step-by-step guides */}
          {section.steps.map((group, gi) => (
            <div key={gi}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {group.heading}
              </h3>
              <ol className="space-y-2">
                {group.steps.map((step, si) => (
                  <li key={si} className="flex gap-3 text-sm text-gray-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {si + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          {/* FAQs */}
          {section.faqs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Common Questions</h3>
              <div className="space-y-3">
                {section.faqs.map((faq, fi) => (
                  <div key={fi} className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Q: {faq.q}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          {section.links && section.links.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {section.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Icon name="open_in_new" size="sm" />
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function HelpView({ role }: { role: string }) {
  const [search, setSearch] = useState('')

  // Split into keywords — skip single-char words and common stopwords only
  const STOPWORDS = new Set(['do','an','the','is','it','in','of','to','a','i','how','what','where','when','why','can'])
  const keywords = search.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2 && !STOPWORDS.has(w))

  const sections = keywords.length === 0
    ? SECTIONS
    : SECTIONS.filter(s => {
        const haystack = [
          s.title,
          s.intro,
          ...s.steps.flatMap(g => [g.heading, ...g.steps]),
          ...s.faqs.flatMap(f => [f.q, f.a]),
        ].join(' ').toLowerCase()
        return keywords.some(k => haystack.includes(k))
      })

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <PageHeader
        title="Help Centre"
        subtitle="Step-by-step guides and answers to common questions"
      />

      {/* Guide chat prompt */}
      <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
        <Icon name="auto_awesome" size="sm" className="text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">Need step-by-step help?</p>
          <p className="text-[12px] text-blue-600 mt-0.5">
            Click the <strong>?</strong> button in the bottom-right corner to chat with the Omnis Guide — ask it anything and it will walk you through it.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search the help centre…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <Icon name="close" size="sm" />
          </button>
        )}
      </div>

      {/* Role-based quick start card */}
      {!search && (
        <RoleQuickStart role={role} />
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Icon name="search_off" size="lg" className="mx-auto mb-2" />
          <p className="text-sm">No results for &ldquo;{search}&rdquo;</p>
          <p className="text-xs mt-1">Try the Guide chat (bottom-right) for a conversational answer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map(s => <AccordionSection key={s.id} section={s} />)}
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-8 pb-4">
        Still stuck? Use the Guide chat (bottom-right) or message your School Admin.
      </p>
    </div>
  )
}

// ── Role quick-start ──────────────────────────────────────────────────────────

const ROLE_QUICKSTART: Record<string, { title: string; bullets: string[] }> = {
  TEACHER: {
    title: 'Quick start — Teacher',
    bullets: [
      'Create a lesson on your Calendar, then add resources and set homework from the Homework tab.',
      'Mark homework in Homework → click a piece → mark submissions in the two-panel view.',
      'View class performance in Analytics → select a class → check the RAG tab.',
      'Set grade predictions by clicking the pencil icon next to each student in the RAG view.',
    ],
  },
  SENCO: {
    title: 'Quick start — SENCO',
    bullets: [
      'Check Early Warning flags every morning from SENCO → Early Warning.',
      'Review ILP Records and approve any AI-drafted plans before they go live.',
      'EHCPs must be approved by you before they become active — check SENCO → EHCP Plans.',
      'Use the Resource Scorer to check that lesson materials meet SEND accessibility standards.',
    ],
  },
  HEAD_OF_DEPT: {
    title: 'Quick start — Head of Department',
    bullets: [
      'Review class performance in Analytics → Classes tab — check each class\'s RAG summary.',
      'Confirm end-of-term grade predictions in the RAG view — look for the green "Confirm grade →" button.',
      'Create Year Group Plans (Schemes of Work) in Plans → Year Group Plans.',
      'Use Adaptive Learning analytics to identify students needing differentiated content.',
    ],
  },
  HEAD_OF_YEAR: {
    title: 'Quick start — Head of Year',
    bullets: [
      'Check open SEND concerns from SENCO → Concerns.',
      'View year group performance in Analytics.',
      'Review revision program coverage to ensure all students have access.',
    ],
  },
  SCHOOL_ADMIN: {
    title: 'Quick start — School Admin',
    bullets: [
      'Sync your MIS data from Admin → MIS Sync (Wonde) to import staff, students, and classes.',
      'Manage GDPR consent records from Admin → GDPR & Consent.',
      'Review the Audit Log for a record of all significant system actions.',
      'Assign cover from Admin → Cover.',
    ],
  },
  STUDENT: {
    title: 'Quick start — Student',
    bullets: [
      'Check your Homework dashboard to see what is due and submit your work.',
      'Use the Revision Planner to add your exams and get a personalised study timetable.',
      'Each revision session has practice questions — rate your confidence 1–5 stars after each one.',
    ],
  },
}

function RoleQuickStart({ role }: { role: string }) {
  const cfg = ROLE_QUICKSTART[role] ?? ROLE_QUICKSTART['TEACHER']
  return (
    <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="rocket_launch" size="sm" className="text-green-600" />
        <h2 className="text-sm font-semibold text-green-800">{cfg.title}</h2>
      </div>
      <ul className="space-y-1.5">
        {cfg.bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700">
            <span className="shrink-0 text-green-500 mt-0.5">→</span>
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
