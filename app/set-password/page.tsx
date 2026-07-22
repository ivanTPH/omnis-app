'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import OmnisLogo from '@/components/ui/OmnisLogo'

function SetPasswordForm() {
  const params  = useSearchParams()
  const token   = params.get('token') ?? ''
  const router  = useRouter()

  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [status,   setStatus]   = useState<'idle' | 'saving' | 'signing-in' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return }
    if (password.length < 8)  { setErrorMsg('Password must be at least 8 characters.'); return }
    setErrorMsg('')
    setStatus('saving')

    const res = await fetch('/api/auth/set-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Something went wrong. Please request a new link.')
      setStatus('error')
      return
    }

    const { email } = await res.json()
    setStatus('signing-in')

    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.ok) {
      setStatus('done')
      router.push('/')
    } else {
      // Password was set but auto-sign-in failed — send to login
      router.push('/login?reason=setup-complete')
    }
  }

  const busy = status === 'saving' || status === 'signing-in'

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      {status === 'done' ? (
        <div className="text-center">
          <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-icons text-green-600">check_circle</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account ready</h2>
          <p className="text-sm text-gray-500">Signing you in…</p>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Set up your account</h2>
          <p className="text-sm text-gray-500 mb-6">Choose a password for your Omnis demo account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{errorMsg}</div>
            )}
            {!token && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                Invalid or missing setup link. Please request a new one below.
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !token}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
            >
              {busy && <span className="material-icons text-base animate-spin">refresh</span>}
              {status === 'saving' ? 'Setting password…' : status === 'signing-in' ? 'Signing in…' : 'Set password & sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Link expired?{' '}
            <Link href="/forgot-password" className="text-blue-700 hover:underline">Request a new one</Link>
          </p>
        </>
      )}
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <OmnisLogo variant="login" background="dark" />
          <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">Loading…</div>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
