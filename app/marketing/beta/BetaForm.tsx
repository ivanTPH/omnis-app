'use client'
import { useState } from 'react'
import Link from 'next/link'

const SIZE_OPTIONS = [
  'Under 500 students',
  '500–1,000 students',
  '1,000–1,500 students',
  'Over 1,500 students',
]

const ROLE_OPTIONS = [
  'Headteacher / Principal',
  'Deputy Headteacher',
  'SLT member',
  'SENCO',
  'Head of Department',
  'Head of Year',
  'Classroom Teacher',
  'IT / Systems Manager',
  'School Business Manager',
  'Other',
]

export default function BetaForm() {
  const [form, setForm] = useState({
    schoolName: '',
    name: '',
    jobTitle: '',
    email: '',
    phone: '',
    schoolSize: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [demoCreated, setDemoCreated] = useState(false)

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/contact/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('failed')
      const json = await res.json().catch(() => ({}))
      setDemoCreated(json.demoCreated === true)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <div className="grid md:grid-cols-2 gap-16 items-start">
        {/* Left — value prop */}
        <div>
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full mb-6">
            Beta programme — limited places
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
            Be among the first schools on Omnis
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            We&apos;re partnering with a small cohort of UK secondary schools to refine the platform before wider release. Beta schools get full access, direct input into the roadmap, and priority onboarding support.
          </p>

          <div className="space-y-5">
            {[
              { icon: 'star', title: 'Full platform access', desc: 'Every feature — SEND management, adaptive homework, analytics, MIS sync — from day one.' },
              { icon: 'support_agent', title: 'Dedicated onboarding', desc: 'We help you get set up, seed your data, and train your staff at no extra cost.' },
              { icon: 'edit', title: 'Shape the roadmap', desc: 'Your feedback directly influences what we build next. Monthly calls with the founding team.' },
              { icon: 'lock', title: 'No long-term commitment', desc: 'Beta schools access Omnis free of charge during the trial period. No contract required.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-icons text-blue-700 text-base">{icon}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          {status === 'sent' ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-icons text-green-600 text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {demoCreated ? 'Check your email' : 'Application received'}
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                {demoCreated
                  ? "We've sent your Omnis demo login details to your email address. You can start exploring the platform right now."
                  : "We'll be in touch within 2 working days to arrange an intro call and set up your demo access."}
              </p>
              {demoCreated && (
                <Link href="/login" className="inline-block bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors mb-4">
                  Sign in to Omnis →
                </Link>
              )}
              <div>
                <Link href="/marketing/home" className="text-blue-700 text-sm font-medium hover:underline">← Back to home</Link>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Apply for beta access</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.schoolName}
                    onChange={e => update('schoolName', e.target.value)}
                    placeholder="e.g. Westfield Academy"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder="Full name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job title <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={form.jobTitle}
                      onChange={e => update('jobTitle', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    >
                      <option value="">Select…</option>
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="you@school.ac.uk"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => update('phone', e.target.value)}
                      placeholder="01234 567890"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School size <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={form.schoolSize}
                      onChange={e => update('schoolSize', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    >
                      <option value="">Select…</option>
                      {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anything else you&apos;d like to tell us? <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    rows={3}
                    placeholder="Current pain points, MIS system, SEND challenges…"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  />
                </div>
                {status === 'error' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    Something went wrong. Please email us directly at <a href="mailto:ivanyardley@me.com" className="underline">ivanyardley@me.com</a>.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {status === 'sending' && (
                    <span className="material-icons text-base animate-spin">refresh</span>
                  )}
                  {status === 'sending' ? 'Submitting…' : 'Submit application'}
                </button>
                <p className="text-xs text-gray-400 text-center">We&apos;ll never share your details. No spam — just a reply from the founding team.</p>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
