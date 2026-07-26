'use client'
import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import Icon from '@/components/ui/Icon'
import { getDemoSessionEmail } from '@/app/actions/demo'

const OWNER_EMAIL = 'ivanyardley@me.com'
const LS_KEY     = 'omnis-demo-owner'

const SCHOOL_ROLES = [
  { label: 'Teacher',            email: 'j.patel@omnisdemo.school' },
  { label: 'SENCo',              email: 'r.morris@omnisdemo.school' },
  { label: 'Head of Year',       email: 't.adeyemi@omnisdemo.school' },
  { label: 'Head of Dept',       email: 'd.brooks@omnisdemo.school' },
  { label: 'SLT',                email: 'c.roberts@omnisdemo.school' },
  { label: 'School Admin',       email: 'admin@omnisdemo.school' },
  { label: 'Teaching Assistant', email: 'j.taylor@omnisdemo.school' },
  { label: 'Student',            email: 'a.hughes@students.omnisdemo.school' },
  { label: 'Parent',             email: 'l.hughes@parents.omnisdemo.school' },
]

const PLATFORM_ROLES = [
  { label: 'Academy Admin',  email: 'academy@omnis.edu' },
  { label: 'Platform Admin', email: 'platform@omnis.edu' },
]

export default function DemoRoleSwitcher() {
  const [visible,      setVisible]      = useState(false)
  const [open,         setOpen]         = useState(false)
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const [switching,    setSwitching]    = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getDemoSessionEmail().then(email => {
      if (email === OWNER_EMAIL) {
        localStorage.setItem(LS_KEY, '1')
        setCurrentEmail(email)
        setVisible(true)
      } else if (localStorage.getItem(LS_KEY) === '1') {
        // switched into a demo account — keep switcher visible
        setCurrentEmail(email)
        setVisible(true)
      }
    }).catch(() => {
      if (localStorage.getItem(LS_KEY) === '1') setVisible(true)
    })
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!visible) return null

  async function switchTo(email: string, isOwner = false) {
    setSwitching(email)
    setOpen(false)
    const password = isOwner ? undefined : 'Demo1234!'
    if (isOwner) {
      // Return to own account — clear demo mode flag first
      localStorage.removeItem(LS_KEY)
    }
    const result = await signIn('credentials', {
      email,
      password: password ?? 'Demo1234!',
      redirect: false,
    })
    if (result?.error) {
      setSwitching(null)
      if (isOwner) localStorage.setItem(LS_KEY, '1') // restore flag on failure
    } else {
      window.location.href = '/'
    }
  }

  const isOnDemoAccount = currentEmail !== OWNER_EMAIL
  const allDemoEmails = [...SCHOOL_ROLES, ...PLATFORM_ROLES].map(r => r.email)
  const isOnKnownDemo = currentEmail ? allDemoEmails.includes(currentEmail) : false

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-3">
            <p className="text-white text-xs font-semibold uppercase tracking-wide">Demo role switcher</p>
            {currentEmail && (
              <p className="text-blue-200 text-xs mt-0.5 truncate">
                Signed in as <span className="text-white font-medium">{currentEmail.split('@')[0]}</span>
              </p>
            )}
          </div>

          <div className="p-3 max-h-[60vh] overflow-y-auto space-y-3">
            {/* Return to own account */}
            {isOnDemoAccount && (
              <button
                onClick={() => switchTo(OWNER_EMAIL, true)}
                disabled={!!switching}
                className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                <Icon name="person" size="sm" />
                <span className="flex-1 text-left">Your account</span>
                {switching === OWNER_EMAIL && <Icon name="refresh" size="sm" className="animate-spin" />}
              </button>
            )}

            {/* School roles */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                Omnis Demo School
              </p>
              <div className="space-y-1">
                {SCHOOL_ROLES.map(r => {
                  const isCurrent = currentEmail === r.email
                  const isLoading = switching === r.email
                  return (
                    <button
                      key={r.email}
                      onClick={() => !isCurrent && switchTo(r.email)}
                      disabled={!!switching || isCurrent}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 font-semibold cursor-default'
                          : 'hover:bg-gray-50 text-gray-700 disabled:opacity-50'
                      }`}
                    >
                      <span className="flex-1 text-left">{r.label}</span>
                      <span className="text-xs text-gray-400">{r.email.split('@')[0]}</span>
                      {isLoading && <Icon name="refresh" size="sm" className="animate-spin text-blue-500" />}
                      {isCurrent && !isLoading && <Icon name="check_circle" size="sm" className="text-blue-500" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Platform roles */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                Platform &amp; Academy
              </p>
              <div className="space-y-1">
                {PLATFORM_ROLES.map(r => {
                  const isCurrent = currentEmail === r.email
                  const isLoading = switching === r.email
                  return (
                    <button
                      key={r.email}
                      onClick={() => !isCurrent && switchTo(r.email)}
                      disabled={!!switching || isCurrent}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 font-semibold cursor-default'
                          : 'hover:bg-gray-50 text-gray-700 disabled:opacity-50'
                      }`}
                    >
                      <span className="flex-1 text-left">{r.label}</span>
                      <span className="text-xs text-gray-400">{r.email.split('@')[0]}</span>
                      {isLoading && <Icon name="refresh" size="sm" className="animate-spin text-blue-500" />}
                      {isCurrent && !isLoading && <Icon name="check_circle" size="sm" className="text-blue-500" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
            Visible only to ivanyardley@me.com
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!switching && !open}
        className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-all ${
          isOnKnownDemo
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-blue-700 hover:bg-blue-800 text-white'
        } disabled:opacity-60`}
        title="Switch demo role"
      >
        {switching && !open
          ? <Icon name="refresh" size="sm" className="animate-spin" />
          : <Icon name="swap_horiz" size="sm" />
        }
        {open ? 'Close' : isOnKnownDemo ? 'Demo active' : 'Switch role'}
      </button>
    </div>
  )
}
