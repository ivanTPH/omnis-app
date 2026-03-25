'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  X, Loader2, Mail, Phone, Users, Heart, FileText, MessageSquare, Send,
} from 'lucide-react'
import { getStudentContactData, saveStudentQuickNote, type StudentContactData } from '@/app/actions/student-contact'
import StudentAvatar from '@/components/StudentAvatar'

const SEND_BADGE: Record<string, { label: string; cls: string }> = {
  SEN_SUPPORT: { label: 'SEN Support', cls: 'bg-blue-100 text-blue-800' },
  EHCP:        { label: 'EHCP',        cls: 'bg-purple-100 text-purple-800' },
}

interface Props {
  studentId: string | null
  onClose:   () => void
  zIndex?:   number   // allow callers inside modals to boost z-index
}

export default function StudentContactPanel({ studentId, onClose, zIndex = 50 }: Props) {
  const [data,    setData]    = useState<StudentContactData | null>(null)
  const [loading, setLoading] = useState(false)
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch when student changes
  useEffect(() => {
    if (!studentId) { setData(null); setNote(''); return }
    setLoading(true)
    setData(null)
    setNote('')
    getStudentContactData(studentId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [studentId])

  // Escape key to close
  useEffect(() => {
    if (!studentId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studentId, onClose])

  async function handleSaveNote() {
    if (!studentId || !note.trim() || saving) return
    setSaving(true)
    try {
      await saveStudentQuickNote(studentId, note)
      setNote('')
      // Refresh notes
      const updated = await getStudentContactData(studentId)
      setData(updated)
    } finally {
      setSaving(false)
    }
  }

  const open = !!studentId

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30"
          style={{ zIndex }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-[380px] max-w-[95vw] bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ zIndex: zIndex + 1 }}
        aria-modal="true"
        role="dialog"
        aria-label="Student contact details"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Student Profile</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}

          {!loading && !data && studentId && (
            <div className="p-6 text-sm text-gray-400 text-center">Could not load student data.</div>
          )}

          {!loading && data && (
            <div className="space-y-0">

              {/* ── Student header ── */}
              <div className="px-5 py-5 flex items-center gap-3 bg-gray-50 border-b border-gray-200">
                <StudentAvatar
                  firstName={data.firstName}
                  lastName={data.lastName}
                  avatarUrl={data.avatarUrl}
                  sendStatus={data.sendStatus as 'SEN_SUPPORT' | 'EHCP' | null | undefined}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-[15px] truncate">
                    {data.firstName} {data.lastName}
                  </p>
                  {data.yearGroup && (
                    <p className="text-xs text-gray-500 mt-0.5">Year {data.yearGroup}</p>
                  )}
                  {data.sendStatus && SEND_BADGE[data.sendStatus] && (
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${SEND_BADGE[data.sendStatus].cls}`}>
                        <Heart size={9} />
                        {SEND_BADGE[data.sendStatus].label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SEND links ── */}
              {(data.hasIlp || data.hasEhcp) && (
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                  {data.hasIlp && (
                    <Link
                      href={`/send/ilp/${data.ilpStudentId}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-[12px] text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <FileText size={12} />
                      View ILP
                    </Link>
                  )}
                  {data.hasEhcp && (
                    <Link
                      href={`/senco/ehcp`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-[12px] text-purple-600 hover:text-purple-800 font-medium"
                    >
                      <FileText size={12} />
                      View EHCP
                    </Link>
                  )}
                </div>
              )}

              {/* ── Student contact ── */}
              <Section label="Student Contact">
                <ContactRow icon={Mail} value={data.email} href={`mailto:${data.email}`} />
                {data.phone && <ContactRow icon={Phone} value={data.phone} href={`tel:${data.phone}`} />}
              </Section>

              {/* ── Parents / carers ── */}
              <Section label={`Parents / Carers${data.parents.length > 0 ? ` (${data.parents.length})` : ''}`}>
                {data.parents.length === 0 ? (
                  <p className="text-[12px] text-gray-400 italic">No carer contact data available.</p>
                ) : (
                  <div className="space-y-4">
                    {data.parents.map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Users size={11} className="text-gray-400 shrink-0" />
                          <span className="text-[13px] font-medium text-gray-800">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {p.relationship}
                            {p.hasParentalResp && ' · PR'}
                          </span>
                        </div>
                        {p.email && <ContactRow icon={Mail} value={p.email} href={`mailto:${p.email}`} indent />}
                        {p.phone && <ContactRow icon={Phone} value={p.phone} href={`tel:${p.phone}`} indent />}
                        {!p.email && !p.phone && (
                          <p className="text-[11px] text-gray-400 italic pl-4">No contact details on record.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* ── Quick notes ── */}
              <Section label="Quick Notes">
                {/* Add note */}
                <div className="space-y-2">
                  <textarea
                    ref={textareaRef}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add a note about this student…"
                    rows={3}
                    className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNote}
                      disabled={!note.trim() || saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      Save note
                    </button>
                  </div>
                </div>

                {/* Existing notes */}
                {data.quickNotes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {data.quickNotes.map(n => (
                      <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1">
                        <div className="flex items-start gap-1.5">
                          <MessageSquare size={11} className="text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-[12px] text-gray-700 leading-relaxed">{n.content}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 pl-4">
                          {n.authorName} · {new Date(n.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">{label}</p>
      {children}
    </div>
  )
}

function ContactRow({ icon: Icon, value, href, indent }: {
  icon:   React.ElementType
  value:  string
  href:   string
  indent?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${indent ? 'pl-4' : ''}`}>
      <Icon size={11} className="text-gray-400 shrink-0" />
      <a
        href={href}
        className="text-[12px] text-blue-600 hover:text-blue-800 truncate"
      >
        {value}
      </a>
    </div>
  )
}
