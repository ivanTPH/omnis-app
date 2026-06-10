'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import OmnisLogo from '@/components/ui/OmnisLogo'

const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true'

const SCHOOL_DEMOS = [
  { role: 'Teacher',           email: 'j.patel@omnisdemo.school'           },
  { role: 'SENCo',             email: 'r.morris@omnisdemo.school'           },
  { role: 'Head of Year',      email: 't.adeyemi@omnisdemo.school'          },
  { role: 'Head of Dept',      email: 'd.brooks@omnisdemo.school'           },
  { role: 'SLT',               email: 'c.roberts@omnisdemo.school'          },
  { role: 'School Admin',      email: 'admin@omnisdemo.school'              },
  { role: 'Teaching Assistant',email: 'j.taylor@omnisdemo.school'           },
  { role: 'Student',           email: 'a.hughes@students.omnisdemo.school'  },
  { role: 'Parent',            email: 'l.hughes@parents.omnisdemo.school'   },
]

const PLATFORM_DEMOS = [
  { role: 'Academy Admin',     email: 'academy@omnis.edu'   },
  { role: 'Platform Admin',    email: 'platform@omnis.edu'  },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { setError('Invalid email or password.'); setLoading(false) }
    else { window.location.href = '/' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <OmnisLogo variant="login" background="dark" />
          <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="you@school.ac.uk" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" required />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <p className="text-center text-sm text-gray-500">
              <a href="/forgot-password" className="text-blue-700 hover:underline">Forgot your password?</a>
            </p>
          </form>
        </div>
        {SHOW_DEMO && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 space-y-4">
            <p className="text-blue-100 text-sm font-medium">Demo accounts — password: <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">Demo1234!</span></p>

            <div>
              <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-wide mb-2">Omnis Demo School</p>
              <div className="grid grid-cols-2 gap-2">
                {SCHOOL_DEMOS.map(d => (
                  <button key={d.email} onClick={() => { setEmail(d.email); setPassword('Demo1234!') }} className="text-left bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition">
                    <div className="text-white text-xs font-medium">{d.role}</div>
                    <div className="text-blue-200 text-xs truncate">{d.email.split('@')[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-wide mb-2">Platform &amp; Academy</p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_DEMOS.map(d => (
                  <button key={d.email} onClick={() => { setEmail(d.email); setPassword('Demo1234!') }} className="text-left bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition">
                    <div className="text-white text-xs font-medium">{d.role}</div>
                    <div className="text-blue-200 text-xs truncate">{d.email}</div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-blue-300 text-xs">Click any account to fill in, then Sign in</p>
          </div>
        )}
      </div>
    </div>
  )
}
