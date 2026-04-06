'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const demoAccounts = [
    { role: 'Teacher', email: 'j.patel@omnisdemo.school' },
    { role: 'SENCo', email: 'r.morris@omnisdemo.school' },
    { role: 'Head of Year', email: 't.adeyemi@omnisdemo.school' },
    { role: 'Student', email: 'a.hughes@students.omnisdemo.school' },
    { role: 'Parent', email: 'l.hughes@parents.omnisdemo.school' },
    { role: 'Admin', email: 'admin@omnisdemo.school' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-2xl font-bold text-blue-800">O</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Omnis</h1>
          <p className="text-blue-200 mt-1">Learning & SEND Intelligence Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="you@school.ac.uk"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div className="mt-6 bg-white/10 backdrop-blur rounded-2xl p-6">
          <p className="text-blue-100 text-sm font-medium mb-3">
            🎓 Demo accounts — password: <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">Demo1234!</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map(account => (
              <button
                key={account.email}
                onClick={() => {
                  setEmail(account.email)
                  setPassword('Demo1234!')
                }}
                className="text-left bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition"
              >
                <div className="text-white text-xs font-medium">{account.role}</div>
                <div className="text-blue-200 text-xs truncate">{account.email.split('@')[0]}</div>
              </button>
            ))}
          </div>
          <p className="text-blue-300 text-xs mt-3">Click any account to auto-fill, then click Sign in</p>
        </div>
      </div>
    </div>
  )
}
