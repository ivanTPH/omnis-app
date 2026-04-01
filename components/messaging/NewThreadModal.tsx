'use client'
import { useState, useTransition, useMemo, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { createThread, getContactList } from '@/app/actions/messaging'
import type { ContactGroup } from '@/app/actions/messaging'
import StudentAvatar from '@/components/StudentAvatar'
import { useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  TEACHER:       'Teachers',
  HEAD_OF_DEPT:  'Heads of Dept',
  HEAD_OF_YEAR:  'Heads of Year',
  SENCO:         'SENCOs',
  SLT:           'Senior Leadership',
  SCHOOL_ADMIN:  'Admin',
  STUDENT:       'Students',
  PARENT:        'Parents',
}

type Contact = ContactGroup['contacts'][number]

type Props = {
  onClose:                () => void
  prefillRecipientIds?:   string[]
  prefillSubject?:        string
  prefillContext?:        string
  prefillContextId?:      string
  prefillIsPrivate?:      boolean
}

export default function NewThreadModal({
  onClose,
  prefillRecipientIds = [],
  prefillSubject = '',
  prefillContext = 'general',
  prefillContextId,
  prefillIsPrivate = false,
}: Props) {
  const router = useRouter()
  const [step,       setStep]       = useState<1 | 2>(prefillRecipientIds.length > 0 ? 2 : 1)
  const [contacts,   setContacts]   = useState<ContactGroup[] | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Contact[]>([])
  const [subject,    setSubject]    = useState(prefillSubject)
  const [body,       setBody]       = useState('')
  const [context,    setContext]    = useState(prefillContext)
  const [isPrivate,  setIsPrivate]  = useState(prefillIsPrivate)
  const [isPending,  startSend]     = useTransition()
  const [error,      setError]      = useState('')

  // Load contacts on mount
  useEffect(() => {
    setLoading(true)
    getContactList().then(c => {
      setContacts(c)
      // Pre-select recipients if provided
      if (prefillRecipientIds.length > 0) {
        const flat = c.flatMap(g => g.contacts)
        setSelected(flat.filter(ct => prefillRecipientIds.includes(ct.id)))
      }
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (!contacts) return []
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts
      .map(g => ({
        ...g,
        contacts: g.contacts.filter(c =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.contacts.length > 0)
  }, [contacts, search])

  function toggle(c: Contact) {
    setSelected(prev =>
      prev.some(s => s.id === c.id)
        ? prev.filter(s => s.id !== c.id)
        : [...prev, c]
    )
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) { setError('Subject and message required'); return }
    if (selected.length === 0) { setError('Select at least one recipient'); return }
    setError('')
    startSend(async () => {
      try {
        const result = await createThread({
          recipientIds: selected.map(s => s.id),
          subject:      subject.trim(),
          body:         body.trim(),
          context,
          contextId:    prefillContextId,
          isPrivate,
        })
        onClose()
        router.push(`/messages?threadId=${result.threadId}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to send message'
        setError(msg)
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Message</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Icon name="close" size="md" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {step === 1 ? (
            /* Step 1 — Select recipients */
            <div className="p-4 space-y-3">
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50 rounded-xl border border-blue-100">
                  {selected.map(c => (
                    <button
                      key={c.id}
                      onClick={() => toggle(c)}
                      className="flex items-center gap-1 text-[12px] bg-blue-600 text-white px-2 py-0.5 rounded-full"
                    >
                      {c.firstName} {c.lastName} <Icon name="close" size="sm" />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {loading ? (
                <p className="text-[12px] text-gray-400 text-center py-6">Loading contacts…</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-auto">
                  {filtered.map(group => (
                    <div key={group.role}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-1">
                        {ROLE_LABELS[group.role] ?? group.role}
                      </p>
                      <div className="space-y-0.5">
                        {group.contacts.map(c => {
                          const isSelected = selected.some(s => s.id === c.id)
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggle(c)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <StudentAvatar firstName={c.firstName} lastName={c.lastName} avatarUrl={c.avatarUrl} size="xs" userId={c.id} />
                              <span className="text-[13px] font-medium text-gray-800 flex-1">
                                {c.firstName} {c.lastName}
                              </span>
                              <span className="text-[10px] text-gray-400 capitalize">{c.role.toLowerCase().replace(/_/g, ' ')}</span>
                              {isSelected && <Icon name="check" size="sm" className="text-blue-600 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && search && (
                    <p className="text-[12px] text-gray-400 text-center py-4">No contacts found</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Step 2 — Compose */
            <div className="p-4 space-y-3">
              {selected.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-500">To:</span>
                  {selected.map(c => (
                    <span key={c.id} className="text-[12px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {c.firstName} {c.lastName}
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={context}
                onChange={e => {
                  setContext(e.target.value)
                  if (e.target.value === 'send') setIsPrivate(true)
                  else setIsPrivate(false)
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="general">General</option>
                <option value="homework">Homework</option>
                <option value="send">SEND</option>
                <option value="parent_evening">Parent Evening</option>
              </select>
              {context === 'send' && (
                <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <Icon name="lock" size="sm" className="text-purple-600 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-purple-700">
                    This thread will be marked <strong>private</strong> — only participants can see it. SEND-related information is protected.
                  </p>
                </div>
              )}
              <textarea
                rows={5}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {error && <p className="text-[12px] text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="text-[13px] text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                onClick={() => setStep(2)}
                disabled={selected.length === 0}
                className="text-[13px] font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl disabled:opacity-40 hover:bg-blue-700"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="text-[13px] text-gray-500 hover:text-gray-700">Back</button>
              <button
                onClick={handleSend}
                disabled={isPending || !subject.trim() || !body.trim()}
                className="text-[13px] font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl disabled:opacity-40 hover:bg-blue-700"
              >
                {isPending ? 'Sending…' : 'Send Message'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
