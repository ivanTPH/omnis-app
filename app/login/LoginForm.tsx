'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import OmnisLogo from '@/components/ui/OmnisLogo'
import { requestLoginMfaCode } from '@/app/actions/mfa'

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

export default function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfaStep, setMfaStep] = useState(false) // true once a code has been emailed and we're waiting for it
  const [rememberMe, setRememberMe] = useState(true)

  // Step 1: verify credentials. Staff accounts get emailed a code and move
  // to step 2; everyone else (or if MFA infra isn't configured) signs in
  // immediately, unchanged from the original single-step flow.
  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const mfaResult = await requestLoginMfaCode(email, password)

    if (mfaResult.status === 'rate_limited') {
      setError(mfaResult.message)
      setLoading(false)
      return
    }

    if (mfaResult.status === 'code_sent') {
      setMfaStep(true)
      setLoading(false)
      return
    }

    // status === 'not_required' — either wrong credentials, a non-staff
    // role, or MFA infra unavailable. signIn() itself is still the real
    // security check either way.
    const result = await signIn('credentials', { email, password, rememberMe: String(rememberMe), redirect: false })
    if (result?.error) { setError('Invalid email or password.'); setLoading(false) }
    else { window.location.href = '/' }
  }

  // Step 2: submit the emailed code alongside the original credentials.
  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await signIn('credentials', { email, password, otpCode, rememberMe: String(rememberMe), redirect: false })
    if (result?.error) { setError('Invalid or expired code. Try again.'); setLoading(false) }
    else { window.location.href = '/' }
  }

  async function handleResendCode() {
    setLoading(true); setError('')
    const mfaResult = await requestLoginMfaCode(email, password)
    if (mfaResult.status === 'rate_limited') setError(mfaResult.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <OmnisLogo variant="login" background="dark" />
          <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-4">
          {!mfaStep ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="you@school.ac.uk" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" required />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">Remember me on this device</span>
                </label>
                {error && <div role="alert" aria-live="polite" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition">
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <p className="text-center text-sm text-gray-500">
                  <a href="/forgot-password" className="text-blue-700 hover:underline">Forgot your password?</a>
                </p>
              </form>
            </>
          ) : (
            <>
              {/* aria-live announcement when the MFA screen appears */}
              <div aria-live="polite" className="sr-only">
                A 6-digit sign-in code has been sent to {email}. Enter it below.
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                We&#39;ve sent a 6-digit code to <strong>{email}</strong>. It expires in 5 minutes.
              </p>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label htmlFor="otp-input" className="block text-sm font-medium text-gray-700 mb-1">Sign-in code</label>
                  <input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center text-2xl tracking-[0.5em] font-semibold"
                    placeholder="------"
                    required
                    aria-describedby={error ? 'mfa-error' : undefined}
                  />
                </div>
                {error && <div id="mfa-error" role="alert" aria-live="polite" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
                <button type="submit" disabled={loading || otpCode.length !== 6} className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition">
                  {loading ? 'Verifying...' : 'Verify and sign in'}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setMfaStep(false); setOtpCode(''); setError('') }} className="text-gray-500 hover:underline" aria-label="Back to sign-in">
                    &larr; Back
                  </button>
                  <button type="button" onClick={handleResendCode} disabled={loading} className="text-blue-700 hover:underline disabled:opacity-60" aria-label="Resend sign-in code">
                    Resend code
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
        {!mfaStep && showDemo && (
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
