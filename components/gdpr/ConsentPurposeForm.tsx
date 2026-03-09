'use client'

import { useState, useTransition } from 'react'
import { createPurpose } from '@/app/actions/gdpr'

const LAWFUL_BASIS_OPTIONS = [
  { value: 'consent',              label: 'Consent'              },
  { value: 'legitimate_interest',  label: 'Legitimate Interest'  },
  { value: 'legal_obligation',     label: 'Legal Obligation'     },
]

type Props = {
  schoolId: string
  onDone: () => void
}

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function ConsentPurposeForm({ schoolId, onDone }: Props) {
  const [title,       setTitle]       = useState('')
  const [slug,        setSlug]        = useState('')
  const [description, setDescription] = useState('')
  const [lawfulBasis, setLawfulBasis] = useState('consent')
  const [error,       setError]       = useState('')
  const [pending, startTransition]    = useTransition()

  function handleTitleChange(v: string) {
    setTitle(v)
    setSlug(toSlug(v))
  }

  function validate() {
    if (!title.trim())       return 'Title is required'
    if (!slug.trim())        return 'Slug is required'
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug must be lowercase letters, numbers and hyphens only'
    if (!description.trim()) return 'Description is required'
    return ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    startTransition(async () => {
      await createPurpose(schoolId, { slug, title, description, lawfulBasis })
      onDone()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
      <h3 className="text-[13px] font-semibold text-gray-800">New Consent Purpose</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="e.g. SEND Data Sharing"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Slug (auto-generated)</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(toSlug(e.target.value))}
            placeholder="e.g. send-data-sharing"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-gray-600 mb-1">Description (shown to parents)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Plain English explanation of what data is used, why, and who it's shared with."
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-gray-600 mb-1">UK GDPR Lawful Basis</label>
        <select
          value={lawfulBasis}
          onChange={e => setLawfulBasis(e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {LAWFUL_BASIS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-[12px] text-gray-500 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Create Purpose'}
        </button>
      </div>
    </form>
  )
}
