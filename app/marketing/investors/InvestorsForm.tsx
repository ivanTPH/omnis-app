'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function InvestorsForm() {
  const [form, setForm] = useState({ name: '', organisation: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/contact/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <div className="grid md:grid-cols-2 gap-16 items-start">
        {/* Left — pitch */}
        <div>
          <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
            Investor relations
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
            Transforming UK secondary education with AI
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed mb-10">
            Omnis is building the intelligence layer for UK schools — connecting lesson planning, adaptive learning, SEND management, and compliance into a single platform that improves outcomes for every pupil.
          </p>

          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">The opportunity</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { stat: '3,600+', label: 'UK secondary schools' },
                  { stat: '£2.4bn', label: 'EdTech market (UK, 2025)' },
                  { stat: '1 in 5', label: 'Pupils have SEND needs' },
                ].map(({ stat, label }) => (
                  <div key={stat} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{stat}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Why now</h2>
              <div className="space-y-3">
                {[
                  { icon: 'psychology', text: 'Claude AI enables genuinely useful SEND adaptations — not just content reuse' },
                  { icon: 'sync', text: 'Wonde MIS API enables frictionless school onboarding with live student data' },
                  { icon: 'policy', text: 'KCSIE and EHCP compliance pressure is creating urgent demand for integrated SEND tooling' },
                  { icon: 'trending_up', text: 'Post-COVID homework and assessment digitisation is still in early stages across most UK schools' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex gap-3 items-start">
                    <span className="material-icons text-blue-700 text-base mt-0.5 shrink-0">{icon}</span>
                    <p className="text-gray-600 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Traction</h2>
              <div className="space-y-3">
                {[
                  { icon: 'check_circle', text: 'Full platform built and beta-ready: 12 roles, 50+ routes, 155 automated tests' },
                  { icon: 'check_circle', text: 'Live Wonde MIS integration with 30+ staff and 120+ students in test school' },
                  { icon: 'check_circle', text: 'AI homework generation, auto-marking, ILP evidence, and adaptive profiles operational' },
                  { icon: 'check_circle', text: 'Beta school cohort forming — first schools onboarding in 2026' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex gap-3 items-start">
                    <span className="material-icons text-green-600 text-base mt-0.5 shrink-0">{icon}</span>
                    <p className="text-gray-600 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — contact form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          {status === 'sent' ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-icons text-green-600 text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Message received</h2>
              <p className="text-gray-500 text-sm mb-6">We&apos;ll be in touch shortly. Thank you for your interest in Omnis.</p>
              <Link href="/marketing/home" className="text-blue-700 text-sm font-medium hover:underline">← Back to home</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Get in touch</h2>
              <p className="text-gray-500 text-sm mb-6">Interested in learning more about Omnis? We&apos;d love to share our deck and discuss the opportunity.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organisation <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={form.organisation}
                    onChange={e => update('organisation', e.target.value)}
                    placeholder="Fund name or company"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    rows={4}
                    placeholder="What would you like to know about Omnis?"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  />
                </div>
                {status === 'error' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    Something went wrong. Please email us at <a href="mailto:ivanyardley@me.com" className="underline">ivanyardley@me.com</a>.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {status === 'sending' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
