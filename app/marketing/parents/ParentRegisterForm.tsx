'use client'
import { useState } from 'react'

export default function ParentRegisterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    await fetch('/api/parents/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)
    setState('done')
  }

  if (state === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-green-900 leading-relaxed">
        <p className="font-semibold mb-1">Thank you — please check your email.</p>
        <p>
          If this address matches your school’s records and parent accounts are open, you’ll receive an email from
          notifications@omnis.education within a few minutes. The link in it works for 7 days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Your email address
        <input
          type="email" required autoComplete="email" value={email}
          onChange={e => setEmail(e.target.value)}
          className="mt-1 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        />
      </label>
      <button
        type="submit" disabled={state === 'sending'}
        className="w-full bg-gray-900 hover:bg-black disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm"
      >
        {state === 'sending' ? 'Sending…' : 'Send me a set-up link'}
      </button>
    </form>
  )
}
