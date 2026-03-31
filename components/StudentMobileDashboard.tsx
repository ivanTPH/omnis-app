'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'
import { percentToGcseGrade } from '@/lib/grading'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MobileHw = {
  id:       string
  title:    string
  dueAt:    string
  subject:  string
  className: string
  status:   'overdue' | 'due_soon' | 'upcoming' | 'submitted' | 'graded'
  grade?:   string | null
  score?:   number | null   // 0–100 percent
}

export type SubjectProgress = {
  subject:    string
  avgScore:   number   // 0–100
  grade:      number   // GCSE 1–9
  count:      number
}

type Props = {
  firstName:      string
  lastName:       string
  avatarUrl?:     string | null
  schoolName:     string
  homework:       MobileHw[]
  subjectProgress: SubjectProgress[]
  unreadCount:    number
}

// ── Bottom nav tab keys ────────────────────────────────────────────────────────

type Tab = 'home' | 'notifications' | 'progress' | 'messages'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'home',          icon: 'home',            label: 'Home'          },
  { key: 'notifications', icon: 'notifications',   label: 'Alerts'        },
  { key: 'progress',      icon: 'insights',        label: 'Progress'      },
  { key: 'messages',      icon: 'chat_bubble',     label: 'Messages'      },
]

// ── Border colour helpers ──────────────────────────────────────────────────────

const STATUS_BORDER: Record<MobileHw['status'], string> = {
  overdue:   'border-l-red-500',
  due_soon:  'border-l-amber-400',
  upcoming:  'border-l-blue-400',
  submitted: 'border-l-purple-400',
  graded:    'border-l-green-500',
}

const STATUS_LABEL: Record<MobileHw['status'], { text: string; cls: string }> = {
  overdue:   { text: 'Overdue',   cls: 'text-red-600 font-semibold' },
  due_soon:  { text: 'Due soon',  cls: 'text-amber-600 font-medium' },
  upcoming:  { text: 'To do',     cls: 'text-blue-600 font-medium'  },
  submitted: { text: 'Submitted', cls: 'text-purple-600 font-medium' },
  graded:    { text: 'Graded',    cls: 'text-green-600 font-medium' },
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, grade }: { pct: number; grade: number }) {
  const colour =
    pct >= 70 ? 'bg-green-500' :
    pct >= 55 ? 'bg-amber-400' :
                'bg-red-400'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${colour}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={`text-[12px] font-bold w-6 text-right ${
        pct >= 70 ? 'text-green-700' : pct >= 55 ? 'text-amber-600' : 'text-red-600'
      }`}>G{grade}</span>
      <span className="text-[11px] text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentMobileDashboard({
  firstName,
  lastName,
  avatarUrl,
  schoolName,
  homework,
  subjectProgress,
  unreadCount,
}: Props) {
  const [tab, setTab] = useState<Tab>('home')

  const overdue   = homework.filter(h => h.status === 'overdue')
  const dueSoon   = homework.filter(h => h.status === 'due_soon')
  const upcoming  = homework.filter(h => h.status === 'upcoming')
  const submitted = homework.filter(h => h.status === 'submitted')
  const graded    = homework.filter(h => h.status === 'graded')

  // ── Stat pills ───────────────────────────────────────────────────────────────

  const stats = [
    { label: 'To do',     value: overdue.length + dueSoon.length + upcoming.length, colour: overdue.length > 0 ? 'text-red-600' : 'text-gray-900' },
    { label: 'Awaiting',  value: submitted.length,  colour: 'text-amber-600' },
    { label: 'Graded',    value: graded.length,      colour: 'text-green-600' },
  ]

  // ── Home tab content ─────────────────────────────────────────────────────────

  function HomeTab() {
    const groups: { title: string; items: MobileHw[] }[] = [
      { title: 'Overdue',    items: overdue   },
      { title: 'Due soon',   items: dueSoon   },
      { title: 'Upcoming',   items: upcoming  },
      { title: 'Submitted',  items: submitted },
      { title: 'Graded',     items: graded    },
    ].filter(g => g.items.length > 0)

    return (
      <div className="space-y-5 pb-24">
        {/* Stat row */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${s.colour}`}>{s.value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Homework groups */}
        {groups.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Icon name="assignment_turned_in" size="lg" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nothing to do — you&apos;re all caught up!</p>
          </div>
        )}
        {groups.map(g => (
          <section key={g.title}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{g.title}</h2>
            <div className="space-y-2">
              {g.items.map(hw => (
                <Link
                  key={hw.id}
                  href={`/student/homework/${hw.id}`}
                  className={`flex items-center gap-3 bg-white rounded-xl border-l-4 border border-gray-100 shadow-sm px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition ${STATUS_BORDER[hw.status]}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-gray-900 truncate">{hw.title}</p>
                    <p className="text-[12px] text-gray-500 truncate">{hw.className}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {hw.grade ? (
                      <span className="text-[13px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">{hw.grade}</span>
                    ) : (
                      <span className={`text-[12px] ${STATUS_LABEL[hw.status].cls}`}>{STATUS_LABEL[hw.status].text}</span>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  // ── Notifications tab ────────────────────────────────────────────────────────

  function NotificationsTab() {
    return (
      <div className="pb-24">
        {overdue.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="warning" size="sm" className="text-red-600" />
              <p className="text-sm font-semibold text-red-800">Overdue work</p>
            </div>
            <ul className="space-y-1">
              {overdue.map(hw => (
                <li key={hw.id}>
                  <Link href={`/student/homework/${hw.id}`} className="text-[13px] text-red-700 underline">
                    {hw.title} ({hw.className})
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {dueSoon.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="schedule" size="sm" className="text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Due soon</p>
            </div>
            <ul className="space-y-1">
              {dueSoon.map(hw => (
                <li key={hw.id}>
                  <Link href={`/student/homework/${hw.id}`} className="text-[13px] text-amber-800 underline">
                    {hw.title} — due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {graded.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="star" size="sm" className="text-green-600" />
              <p className="text-sm font-semibold text-green-800">Recently graded</p>
            </div>
            <ul className="space-y-1">
              {graded.slice(0, 5).map(hw => (
                <li key={hw.id}>
                  <Link href={`/student/homework/${hw.id}`} className="text-[13px] text-green-800 underline">
                    {hw.title} — {hw.grade}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {overdue.length === 0 && dueSoon.length === 0 && graded.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Icon name="notifications_none" size="lg" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No new notifications</p>
          </div>
        )}
      </div>
    )
  }

  // ── Progress tab ─────────────────────────────────────────────────────────────

  function ProgressTab() {
    return (
      <div className="space-y-4 pb-24">
        <p className="text-[12px] text-gray-500">Your average score per subject this term.</p>
        {subjectProgress.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="insights" size="lg" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No graded work yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {subjectProgress.map(sp => (
              <div key={sp.subject} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[13px] font-medium text-gray-900">{sp.subject}</p>
                  <p className="text-[11px] text-gray-400">{sp.count} piece{sp.count !== 1 ? 's' : ''}</p>
                </div>
                <ProgressBar pct={sp.avgScore} grade={sp.grade} />
              </div>
            ))}
          </div>
        )}

        {/* Revision planner link */}
        <Link
          href="/student/revision"
          className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 hover:bg-blue-100 transition"
        >
          <div>
            <p className="text-[13px] font-semibold text-blue-900">Revision Planner</p>
            <p className="text-[11px] text-blue-700">Plan your revision schedule</p>
          </div>
          <Icon name="chevron_right" size="md" className="text-blue-400" />
        </Link>
      </div>
    )
  }

  // ── Messages tab ─────────────────────────────────────────────────────────────

  function MessagesTab() {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 pb-24">
        <Icon name="chat_bubble_outline" size="lg" className="text-gray-300" />
        <p className="text-sm text-gray-500">Go to full messages view</p>
        <Link
          href="/messages"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          Open Messages
        </Link>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{schoolName}</p>
            <p className="text-[15px] font-semibold text-gray-900 leading-tight">
              {tab === 'home'          && `Hi, ${firstName} 👋`}
              {tab === 'notifications' && 'Alerts'}
              {tab === 'progress'      && 'My Progress'}
              {tab === 'messages'      && 'Messages'}
            </p>
          </div>
          <StudentAvatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} size="sm" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-5">
        {tab === 'home'          && <HomeTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'progress'      && <ProgressTab />}
        {tab === 'messages'      && <MessagesTab />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto flex">
          {TABS.map(t => {
            const active = tab === t.key
            const badge  = t.key === 'notifications' && (overdue.length + dueSoon.length) > 0
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors relative ${
                  active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="relative">
                  <Icon name={t.icon} size="md" />
                  {badge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                  {t.key === 'messages' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                  {t.label}
                </span>
                {active && (
                  <span className="absolute top-0 inset-x-0 h-0.5 bg-blue-500 rounded-b" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
