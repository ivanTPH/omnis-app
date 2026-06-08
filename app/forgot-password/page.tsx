'use client'
import { useState } from 'react'
import Link from 'next/link'
import OmnisLogo from '@/components/ui/OmnisLogo'

export default function ForgotPasswordPage() {
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
    setStatus('sent') // always show success — don't reveal if email exists
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <OmnisLogo variant="login" background="dark" />
          <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {status === 'sent' ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-icons text-green-600">mark_email_read</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your inbox — it may take a minute to arrive.
              </p>
              <Link href="/login" className="text-blue-700 text-sm font-medium hover:underline">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your school email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@school.ac.uk"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition"
                >
                  {status === 'sending' ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                <Link href="/login" className="text-blue-700 hover:underline">← Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
