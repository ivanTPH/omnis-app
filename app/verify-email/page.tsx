'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function VerifyEmailContent() {
  const params    = useSearchParams()
  const router    = useRouter()
  const token     = params.get('token')
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link — no token found.')
      setStatus('error')
      return
    }
    fetch('/api/auth/verify-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          router.replace('/login?verified=1')
        } else {
          setError(data.error || 'This link has expired or already been used.')
          setStatus('error')
        }
      })
      .catch(() => {
        setError('Something went wrong. Please try again.')
        setStatus('error')
      })
  }, [token, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-sm text-center max-w-md w-full">
          <span className="material-icons text-blue-600 text-4xl animate-spin block mb-4">refresh</span>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Verifying your email…</h1>
          <p className="text-gray-500 text-sm">Just a moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-sm text-center max-w-md w-full">
        <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-icons text-red-500 text-3xl">error_outline</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Verification failed</h1>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <Link
          href="/forgot-password"
          className="inline-block bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          Request a new link
        </Link>
        <div className="mt-4">
          <Link href="/login" className="text-blue-600 text-sm hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
