'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { saveSchoolSettings } from '@/app/actions/admin'

/**
 * ICO Children's Code Standard 15 — lets SCHOOL_ADMIN/SLT set the named DPO
 * contact that students see on /student/privacy ("who to ask about my data").
 * Always reachable from the admin dashboard, not locked behind onboarding.
 */
export default function DpoContactCard({
  initialDpoName,
  initialDpoEmail,
}: {
  initialDpoName:  string
  initialDpoEmail: string
}) {
  const [editing, setEditing]   = useState(false)
  const [name,    setName]      = useState(initialDpoName)
  const [email,   setEmail]     = useState(initialDpoEmail)
  const [saved,   setSaved]     = useState({ name: initialDpoName, email: initialDpoEmail })
  const [pending, startTransition] = useTransition()
  const [error,   setError]     = useState<string | null>(null)

  const isSet = !!saved.name || !!saved.email

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await saveSchoolSettings({ dpoName: name, dpoEmail: email })
        setSaved({ name, email })
        setEditing(false)
      } catch {
        setError('Could not save — please try again.')
      }
    })
  }

  function handleCancel() {
    setName(saved.name)
    setEmail(saved.email)
    setError(null)
    setEditing(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Icon name="verified_user" size="sm" className="text-indigo-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-gray-900">Data Protection Officer contact</p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Shown to students on the &quot;How your data is used&quot; page (ICO Children&apos;s Code Standard 15).
            </p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 text-[12px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            {isSet ? 'Edit' : 'Set contact'}
          </button>
        )}
      </div>

      {!editing ? (
        isSet ? (
          <div className="text-[13px] text-gray-700 pl-12">
            <p className="font-medium">{saved.name || 'Unnamed DPO'}</p>
            {saved.email && <p className="text-gray-500">{saved.email}</p>}
          </div>
        ) : (
          <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 ml-12">
            Not set — students currently see a generic &quot;ask your school office&quot; fallback.
          </p>
        )
      ) : (
        <div className="pl-12 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith, School Business Manager"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="dpo@yourschool.sch.uk"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[12px] font-medium rounded-lg transition"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={pending}
              className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-[12px] font-medium rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
