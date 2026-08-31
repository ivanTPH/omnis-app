'use client'
import { useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Icon from '@/components/ui/Icon'
import { recordSignOut } from '@/app/actions/settings'

const SCHOOL_ROLES = [
  { label: 'Teacher',            email: 'j.patel@omnisdemo.school',              icon: 'school' },
  { label: 'SENCo',              email: 'r.morris@omnisdemo.school',             icon: 'psychology' },
  { label: 'Head of Year',       email: 't.adeyemi@omnisdemo.school',            icon: 'supervisor_account' },
  { label: 'Head of Dept',       email: 'd.brooks@omnisdemo.school',             icon: 'menu_book' },
  { label: 'SLT',                email: 'c.roberts@omnisdemo.school',            icon: 'analytics' },
  { label: 'School Admin',       email: 'admin@omnisdemo.school',                icon: 'admin_panel_settings' },
  { label: 'Teaching Assistant', email: 'j.taylor@omnisdemo.school',             icon: 'support_agent' },
  { label: 'Student',            email: 'a.hughes@students.omnisdemo.school',    icon: 'person' },
  { label: 'Parent',             email: 'l.hughes@parents.omnisdemo.school',     icon: 'family_restroom' },
]

const PLATFORM_ROLES = [
  { label: 'Academy Admin',  email: 'academy@omnis.edu',  icon: 'account_balance' },
  { label: 'Platform Admin', email: 'platform@omnis.edu', icon: 'settings' },
]

export default function DemoRolePicker({ firstName }: { firstName: string }) {
  const [switching,   setSwitching]   = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  async function switchTo(email: string) {
    setSwitching(email)
    setSwitchError(null)
    try {
      // Sign out of current session first so NextAuth replaces it cleanly
      await recordSignOut()
      await signOut({ redirect: false })
      const result = await signIn('credentials', {
        email,
        password: 'Demo1234!',
        redirect: false,
      })
      if (result?.error) {
        setSwitchError(`Could not sign in as ${email} — ${result.error}`)
        setSwitching(null)
      } else {
        location.assign('/')
      }
    } catch (err) {
      setSwitchError(String(err))
      setSwitching(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex flex-col items-center justify-start py-12 px-4">

      {/* Header */}
      <div className="flex flex-col items-center mb-10">
        <OmnisLogo variant="login" background="dark" />
        <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
      </div>

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {firstName}
          </h1>
          <p className="text-blue-200 mt-1 text-sm">
            Choose a role to explore — password is <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">Demo1234!</span> for all accounts
          </p>
        </div>

        {/* School roles */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4">
          <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-wide mb-3">
            Omnis Demo School
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SCHOOL_ROLES.map(r => {
              const isLoading = switching === r.email
              return (
                <button
                  key={r.email}
                  onClick={() => switchTo(r.email)}
                  disabled={!!switching}
                  className="flex flex-col items-start gap-1.5 bg-white/10 hover:bg-white/25 disabled:opacity-60 rounded-xl px-4 py-3.5 transition text-left group"
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon
                      name={r.icon}
                      size="sm"
                      className="text-blue-300 group-hover:text-white transition"
                    />
                    {isLoading && (
                      <Icon name="refresh" size="sm" className="animate-spin text-white" />
                    )}
                  </div>
                  <div className="text-white text-sm font-semibold">{r.label}</div>
                  <div className="text-blue-300 text-xs">{r.email.split('@')[0]}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Platform roles */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-5">
          <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-wide mb-3">
            Platform &amp; Academy
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_ROLES.map(r => {
              const isLoading = switching === r.email
              return (
                <button
                  key={r.email}
                  onClick={() => switchTo(r.email)}
                  disabled={!!switching}
                  className="flex flex-col items-start gap-1.5 bg-white/10 hover:bg-white/25 disabled:opacity-60 rounded-xl px-4 py-3.5 transition text-left group"
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon
                      name={r.icon}
                      size="sm"
                      className="text-blue-300 group-hover:text-white transition"
                    />
                    {isLoading && (
                      <Icon name="refresh" size="sm" className="animate-spin text-white" />
                    )}
                  </div>
                  <div className="text-white text-sm font-semibold">{r.label}</div>
                  <div className="text-blue-300 text-xs">{r.email}</div>
                </button>
              )
            })}
          </div>
        </div>

        {switchError && (
          <div className="mt-4 px-4 py-3 bg-red-900/40 border border-red-500/50 text-red-200 text-sm rounded-xl">
            {switchError}
          </div>
        )}

        <p className="text-center text-blue-300 text-xs mt-5">
          Click any role to sign in instantly. Use the <span className="font-medium text-white">Switch role</span> button inside the app to switch without returning here.
        </p>
      </div>
    </div>
  )
}
