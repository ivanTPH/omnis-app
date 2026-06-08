'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import OmnisLogo from '@/components/ui/OmnisLogo'

type InviteInfo = { email: string; firstName: string; lastName: string; role: string }

function AcceptInviteForm() {
  const params = useSearchParams()
  const token  = params.get('token') ?? ''

  const [invite,   setInvite]   = useState<InviteInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [invalid,  setInvalid]  = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [status,   setStatus]   = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return }
    fetch(`/api/staff/accept-invite?token=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: InviteInfo) => { setInvite(d); setLoading(false) })
      .catch(() => { setInvalid(true); setLoading(false) })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return }
    if (password.length < 8)  { setErrorMsg('Password must be at least 8 characters.'); return }
    setErrorMsg('')
    setStatus('saving')
    const res = await fetch('/api/staff/accept-invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, password }),
    })
    if (res.ok) {
      setStatus('done')
    } else {
      const data = await res.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (loading) {
    return <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">Verifying invitation…</div>
  }

  if (invalid) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-icons text-red-500">link_off</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitation expired</h2>
        <p className="text-sm text-gray-500 mb-4">This invitation link has expired or already been used. Please ask your school admin to send a new invitation.</p>
        <Link href="/login" className="text-blue-700 text-sm font-medium hover:underline">Go to sign in</Link>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-icons text-green-600">check_circle</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Account ready</h2>
        <p className="text-sm text-gray-500 mb-6">
          Welcome to Omnis, {invite?.firstName}. You can now sign in with your email address.
        </p>
        <Link href="/login" className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm inline-block">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Set up your account</h2>
      <p className="text-sm text-gray-500 mb-6">
        Welcome, {invite?.firstName}. Choose a password to activate your Omnis account ({invite?.email}).
      </p>
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
        <button
          type="submit"
          disabled={status === 'saving'}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition"
        >
          {status === 'saving' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <OmnisLogo variant="login" background="dark" />
          <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">Loading…</div>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  )
}
