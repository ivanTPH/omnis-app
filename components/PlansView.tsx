'use client'
import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import Link                        from 'next/link'
import {
  FileHeart, Shield, BookOpen, Folder,
  Calendar, ChevronRight, MessageSquare,
  StickyNote, Plus, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import StudentAvatar        from '@/components/StudentAvatar'
import { savePlanNote, messageSencoAboutPlan } from '@/app/actions/plans'
import type { IlpRow, EhcpRow, KPlanRow, PlanNote } from '@/app/actions/plans'

const ILP_STATUS: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  under_review: 'bg-amber-100 text-amber-700',
  archived:     'bg-gray-100 text-gray-400',
}
const ILP_LABEL: Record<string, string> = {
  active:       'Active',
  under_review: 'Under review',
  archived:     'Archived',
}

function isOverdue(d: string) {
  return new Date(d) < new Date()
}

function ReviewDate({ date }: { date: string }) {
  const overdue = isOverdue(date)
  return (
    <div className={`flex items-center gap-1 text-[11px] shrink-0 ${overdue ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
      <Calendar size={11} />
      {overdue
        ? 'Review overdue'
        : `Review ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
    </div>
  )
}

// ── Notes panel ───────────────────────────────────────────────────────────────

function NotesPanel({
  planType,
  planId,
  notes,
}: {
  planType: string
  planId:   string
  notes:    PlanNote[]
}) {
  const [open,  setOpen]  = useState(false)
  const [text,  setText]  = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startSave] = useTransition()

  function handleSave() {
    if (!text.trim()) return
    setError(null)
    startSave(async () => {
      try {
        await savePlanNote(planType, planId, text)
        setText('')
      } catch (err: any) {
        setError(err?.message ?? 'Failed to save note')
      }
    })
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700 font-medium"
      >
        <StickyNote size={11} />
        {notes.length > 0 ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Add note'}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div
          className="mt-2 space-y-2"
          onClick={e => e.preventDefault()}
        >
          {/* Existing notes */}
          {notes.map(n => (
            <div key={n.id} className="bg-gray-50 rounded-lg px-3 py-2 text-[12px]">
              <p className="text-gray-700 whitespace-pre-wrap">{n.note}</p>
              <p className="text-gray-400 mt-1">
                {n.teacherName} · {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}

          {/* New note */}
          <div className="space-y-1.5">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !text.trim()}
              className="flex items-center gap-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              {isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Message SENCO button ──────────────────────────────────────────────────────

function MessageSencoButton({
  sencoId,
  studentName,
  planType,
}: {
  sencoId:     string
  studentName: string
  planType:    string
}) {
  const router = useRouter()
  const [isPending, startMsg] = useTransition()
  const [error, setError]     = useState<string | null>(null)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    startMsg(async () => {
      try {
        const { threadId } = await messageSencoAboutPlan(sencoId, studentName, planType)
        router.push(`/messages/${threadId}`)
      } catch (err: any) {
        setError(err?.message ?? 'Could not start message')
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
      >
        {isPending ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />}
        Message SENCO
      </button>
      {error && <p className="text-[11px] text-rose-600 mt-0.5">{error}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlansView({
  ilps,
  ehcps,
  kplans,
  sencoId,
  role,
}: {
  ilps:    IlpRow[]
  ehcps:   EhcpRow[]
  kplans:  KPlanRow[]
  sencoId: string | null
  role:    string
}) {
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)
  const total   = ilps.length + ehcps.length + kplans.length
  const showMsgSenco = !isSenco && !!sencoId

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Folder size={20} className="text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">SEND Plans</h1>
          <span className="text-[11px] text-gray-400 font-medium">
            {total} plan{total !== 1 ? 's' : ''}
          </span>
        </div>
        {isSenco && (
          <Link
            href="/send/ilp"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            ILP Records <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Folder size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No active SEND plans for your students</p>
          {isSenco && (
            <Link href="/send/ilp" className="mt-3 text-sm text-blue-600 hover:underline">
              View ILP Records →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-5">

          {/* ILPs */}
          {ilps.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileHeart size={11} /> Individual Learning Plans ({ilps.length})
              </p>
              <div className="space-y-2">
                {ilps.map(ilp => {
                  const activeTargets = ilp.targets.filter(t => t.status === 'active').length
                  const studentName   = `${ilp.student.firstName} ${ilp.student.lastName}`
                  return (
                    <div key={ilp.id} className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white">
                      <Link
                        href={`/student/${ilp.student.id}/send`}
                        className="flex items-center gap-4 hover:opacity-80 transition-opacity"
                      >
                        <StudentAvatar
                          firstName={ilp.student.firstName}
                          lastName={ilp.student.lastName}
                          size="sm"
                          sendStatus="SEN_SUPPORT"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{studentName}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            {ilp.sendCategory}{activeTargets > 0 ? ` · ${activeTargets} active target${activeTargets !== 1 ? 's' : ''}` : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${ILP_STATUS[ilp.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ILP_LABEL[ilp.status] ?? ilp.status}
                        </span>
                        <ReviewDate date={ilp.reviewDate} />
                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                      </Link>
                      <div className="flex items-start justify-between gap-3 mt-1">
                        <NotesPanel planType="ilp" planId={ilp.id} notes={ilp.notes} />
                        {showMsgSenco && (
                          <div className="shrink-0 mt-2">
                            <MessageSencoButton sencoId={sencoId!} studentName={studentName} planType="ilp" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* EHCPs */}
          {ehcps.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Shield size={11} /> EHCP Plans ({ehcps.length})
              </p>
              <div className="space-y-2">
                {ehcps.map(ehcp => {
                  const studentName = `${ehcp.student.firstName} ${ehcp.student.lastName}`
                  return (
                    <div key={ehcp.id} className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white">
                      <Link
                        href={`/student/${ehcp.student.id}/send`}
                        className="flex items-center gap-4 hover:opacity-80 transition-opacity"
                      >
                        <StudentAvatar
                          firstName={ehcp.student.firstName}
                          lastName={ehcp.student.lastName}
                          size="sm"
                          sendStatus="EHCP"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{studentName}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            EHCP · {ehcp.localAuthority}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 bg-purple-100 text-purple-700">
                          EHCP
                        </span>
                        <ReviewDate date={ehcp.reviewDate} />
                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                      </Link>
                      <div className="flex items-start justify-between gap-3 mt-1">
                        <NotesPanel planType="ehcp" planId={ehcp.id} notes={ehcp.notes} />
                        {showMsgSenco && (
                          <div className="shrink-0 mt-2">
                            <MessageSencoButton sencoId={sencoId!} studentName={studentName} planType="ehcp" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* K Plans */}
          {kplans.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <BookOpen size={11} /> K Plans / Learning Passports ({kplans.length})
              </p>
              <div className="space-y-2">
                {kplans.map(kplan => {
                  const studentName = `${kplan.student.firstName} ${kplan.student.lastName}`
                  return (
                    <div key={kplan.id} className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white">
                      <Link
                        href={`/student/${kplan.student.id}/send`}
                        className="flex items-center gap-4 hover:opacity-80 transition-opacity"
                      >
                        <StudentAvatar
                          firstName={kplan.student.firstName}
                          lastName={kplan.student.lastName}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{studentName}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">K Plan · Learning Passport</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                          kplan.status === 'ACTIVE_PARENT_SHARED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {kplan.status === 'ACTIVE_PARENT_SHARED' ? 'Shared' : 'Active'}
                        </span>
                        <ReviewDate date={kplan.reviewDate} />
                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                      </Link>
                      <div className="flex items-start justify-between gap-3 mt-1">
                        <NotesPanel planType="kplan" planId={kplan.id} notes={kplan.notes} />
                        {showMsgSenco && (
                          <div className="shrink-0 mt-2">
                            <MessageSencoButton sencoId={sencoId!} studentName={studentName} planType="kplan" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
