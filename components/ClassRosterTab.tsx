'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Icon from '@/components/ui/Icon'
import {
  getClassRoster,
  getStudentClassDetail,
  getStudentRosterDetail,
  addRosterNote,
  type ClassRosterRow,
  type StudentClassDetail,
  type StudentRosterDetail,
} from '@/app/actions/lessons'
import {
  getCurrentUserRole,
  getClassKPlanSummaries,
  getStudentIlp,
  type LearnerPassportRow,
  type IlpWithTargets,
} from '@/app/actions/send-support'
import { getStudentEhcp, type EhcpPlanWithOutcomes } from '@/app/actions/ehcp'
import { getClassRagData, type RagStudent } from '@/app/actions/rag'
import { percentToGcseGrade } from '@/lib/grading'
import StudentAvatar from '@/components/StudentAvatar'
import StudentContactPanel from '@/components/StudentContactPanel'
import type { DocSlideOverDocType } from '@/components/send/DocSlideOver'

const StudentAPDRPanel = dynamic(() => import('@/components/send-support/StudentAPDRPanel'), { ssr: false })
const KPlanModal       = dynamic(() => import('@/components/send-support/KPlanModal'),       { ssr: false })
const DocSlideOver     = dynamic(() => import('@/components/send/DocSlideOver'),             { ssr: false })

// ── Constants ─────────────────────────────────────────────────────────────────

const SEND_BADGE: Record<string, { label: string; cls: string }> = {
  SEN_SUPPORT: { label: 'SEN Support', cls: 'bg-blue-100 text-blue-700' },
  EHCP:        { label: 'EHCP',        cls: 'bg-purple-100 text-purple-700' },
}

const TARGET_STATUS_CLS: Record<string, string> = {
  active:       'bg-blue-100 text-blue-700',
  achieved:     'bg-green-100 text-green-700',
  not_achieved: 'bg-red-100 text-red-700',
  deferred:     'bg-orange-100 text-orange-700',
}

const STATUS_COLORS: Record<string, string> = {
  RETURNED:         'bg-green-100 text-green-700',
  MARKED:           'bg-blue-100 text-blue-700',
  UNDER_REVIEW:     'bg-amber-100 text-amber-700',
  RESUBMISSION_REQ: 'bg-orange-100 text-orange-700',
  SUBMITTED:        'bg-gray-100 text-gray-600',
}

const RAG_DOT: Record<string, string> = {
  green:   'bg-green-500',
  amber:   'bg-amber-400',
  red:     'bg-red-500',
  no_data: 'bg-gray-200',
}

const SECTION_HEADING = 'text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2'

type KPlanSummary = { id: string; sendInformation: string; status: string; teacherActions: string[] }

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClassRosterTab({ classId }: { classId: string }) {
  const [rows,             setRows]             = useState<ClassRosterRow[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [expandedId,       setExpandedId]       = useState<string | null>(null)
  const [contactStudentId, setContactStudentId] = useState<string | null>(null)

  const [detailsCache,     setDetailsCache]     = useState<Record<string, StudentClassDetail | 'loading'>>({})
  const [ilpCache,         setIlpCache]         = useState<Record<string, IlpWithTargets | 'loading' | null>>({})
  const [ehcpCache,        setEhcpCache]        = useState<Record<string, EhcpPlanWithOutcomes | 'loading' | null>>({})
  const [rosterDetailCache, setRosterDetailCache] = useState<Record<string, StudentRosterDetail | 'loading'>>({})

  const [userRole,         setUserRole]         = useState<string>('TEACHER')
  const [kPlanMap,         setKPlanMap]         = useState<Record<string, KPlanSummary>>({})
  const [kPlanModal,       setKPlanModal]       = useState<{ studentId: string; studentName: string; passport: LearnerPassportRow } | null>(null)
  const [kPlanLoading,     setKPlanLoading]     = useState<string | null>(null)
  const [kPlanFullCache,   setKPlanFullCache]   = useState<Record<string, LearnerPassportRow | 'loading'>>({})
  const [kPlanChecked,     setKPlanChecked]     = useState<Record<string, boolean[]>>({})

  const [ragMap,           setRagMap]           = useState<Record<string, RagStudent>>({})

  const [docSlideOver,     setDocSlideOver]     = useState<{ studentId: string; studentName: string; docType: DocSlideOverDocType } | null>(null)

  const [newNotes,         setNewNotes]         = useState<Record<string, string>>({})
  const [savingNote,       setSavingNote]       = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getClassRoster(classId),
      getCurrentUserRole(),
      getClassKPlanSummaries(classId),
      getClassRagData(classId),
    ])
      .then(([r, role, kplans, rag]) => {
        setRows(r)
        setUserRole(role ?? 'TEACHER')
        setKPlanMap(kplans)
        const rm: Record<string, RagStudent> = {}
        for (const s of rag) rm[s.id] = s
        setRagMap(rm)
      })
      .catch(() => setError('Could not load class roster.'))
      .finally(() => setLoading(false))
  }, [classId])

  // ── Expand / collapse ──────────────────────────────────────────────────────

  function handleToggle(row: ClassRosterRow) {
    const id = row.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    loadExpandData(row)
  }

  function loadExpandData(row: ClassRosterRow) {
    const id = row.id
    if (!detailsCache[id]) {
      setDetailsCache(c => ({ ...c, [id]: 'loading' }))
      getStudentClassDetail(id, classId)
        .then(d  => setDetailsCache(c => ({ ...c, [id]: d })))
        .catch(() => setDetailsCache(c => ({ ...c, [id]: { recentSubmissions: [] } })))
    }
    if (!ilpCache[id]) {
      setIlpCache(c => ({ ...c, [id]: 'loading' }))
      getStudentIlp(id)
        .then(ilp => setIlpCache(c => ({ ...c, [id]: ilp })))
        .catch(() => setIlpCache(c => ({ ...c, [id]: null })))
    }
    if (row.sendStatus === 'EHCP' && !ehcpCache[id]) {
      setEhcpCache(c => ({ ...c, [id]: 'loading' }))
      getStudentEhcp(id)
        .then(ehcp => setEhcpCache(c => ({ ...c, [id]: ehcp })))
        .catch(() => setEhcpCache(c => ({ ...c, [id]: null })))
    }
    if (!rosterDetailCache[id]) {
      setRosterDetailCache(c => ({ ...c, [id]: 'loading' }))
      getStudentRosterDetail(id, classId)
        .then(d => setRosterDetailCache(c => ({ ...c, [id]: d })))
        .catch(() => setRosterDetailCache(c => ({ ...c, [id]: { recentHomework: [], examScores: [], rosterNotes: [] } })))
    }
  }

  // ── Doc badge click — opens DocSlideOver ──────────────────────────────────

  function handleDocBadge(e: React.MouseEvent, row: ClassRosterRow, docType: DocSlideOverDocType) {
    e.stopPropagation()
    const studentName = `${row.firstName} ${row.lastName}`
    setDocSlideOver({ studentId: row.id, studentName, docType })
    // Also expand the row if not already open
    if (expandedId !== row.id) {
      setExpandedId(row.id)
      loadExpandData(row)
    }
  }

  // ── K Plan full view ───────────────────────────────────────────────────────

  async function openKPlanModal(studentId: string, studentName: string) {
    setKPlanLoading(studentId)
    try {
      const { getStudentLearnerPassport } = await import('@/app/actions/send-support')
      const passport = await getStudentLearnerPassport(studentId)
      if (passport) setKPlanModal({ studentId, studentName, passport })
    } finally {
      setKPlanLoading(null)
    }
  }

  function refreshKPlanMap() {
    getClassKPlanSummaries(classId).then(setKPlanMap).catch(() => {})
  }

  function loadKPlanFull(studentId: string) {
    if (!kPlanFullCache[studentId]) {
      setKPlanFullCache(c => ({ ...c, [studentId]: 'loading' }))
      import('@/app/actions/send-support').then(({ getStudentLearnerPassport }) => {
        getStudentLearnerPassport(studentId)
          .then(p => {
            setKPlanFullCache(c => ({ ...c, [studentId]: p ?? ('loading' as any) }))
            if (p) setKPlanChecked(ch => ({ ...ch, [studentId]: new Array(p.teacherActions.length).fill(false) }))
          })
          .catch(() => setKPlanFullCache(c => ({ ...c, [studentId]: 'loading' })))
      })
    }
  }

  // ── Save roster note ───────────────────────────────────────────────────────

  async function handleSaveNote(studentId: string) {
    const content = newNotes[studentId]?.trim()
    if (!content) return
    setSavingNote(studentId)
    try {
      await addRosterNote(studentId, content)
      setNewNotes(n => ({ ...n, [studentId]: '' }))
      const updated = await getStudentRosterDetail(studentId, classId)
      setRosterDetailCache(c => ({ ...c, [studentId]: updated }))
    } finally {
      setSavingNote(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="refresh" size="md" className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 py-8 justify-center text-[13px]">
        <Icon name="error" size="sm" /> {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-gray-400 text-center py-10">No students enrolled in this class.</p>
    )
  }

  const senSupportCount = rows.filter(r => r.sendStatus === 'SEN_SUPPORT').length
  const ehcpCount       = rows.filter(r => r.sendStatus === 'EHCP').length
  const sendCount       = senSupportCount + ehcpCount
  const ilpCount        = rows.filter(r => r.hasIlp).length

  return (
    <div className="space-y-4">

      {/* SEND summary card */}
      {sendCount > 0 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Icon name="info" size="sm" className="text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-3">
              {senSupportCount > 0 && (
                <span className="text-[12px] font-semibold text-blue-800">
                  {senSupportCount} student{senSupportCount !== 1 ? 's' : ''} with SEN Support
                </span>
              )}
              {ehcpCount > 0 && (
                <span className="text-[12px] font-semibold text-purple-800">
                  {ehcpCount} student{ehcpCount !== 1 ? 's' : ''} with EHCP
                </span>
              )}
              {ilpCount > 0 && (
                <span className="text-[12px] text-blue-600">
                  {ilpCount} active ILP{ilpCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <a
              href="/send/dashboard"
              className="text-[11px] text-blue-500 hover:text-blue-700 mt-0.5 inline-block"
            >
              View SEND dashboard →
            </a>
          </div>
        </div>
      )}

      {/* Student count chip */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
          {rows.length} students
        </span>
      </div>

      {/* Student rows */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {rows.map(row => {
          const badge        = SEND_BADGE[row.sendStatus]
          const isSend       = row.sendStatus !== 'NONE'
          const scoreDisplay = row.latestScore != null
            ? (row.maxScore ? `${Math.round(row.latestScore)}/${row.maxScore}` : `${Math.round(row.latestScore)}`)
            : null
          const isExpanded   = expandedId === row.id
          const detail       = detailsCache[row.id]
          const ilpData      = ilpCache[row.id]
          const kPlan        = kPlanMap[row.id]
          const ehcpData     = ehcpCache[row.id]
          const rosterDetail = rosterDetailCache[row.id]
          const ragStudent   = ragMap[row.id]
          const studentName  = `${row.firstName} ${row.lastName}`

          // EHCP Section F provisions
          const ehcpSectionF = ehcpData && ehcpData !== 'loading' && ehcpData.sections?.F
            ? ehcpData.sections.F.split(/\n+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
            : []

          const kPlanAdjustments = kPlan?.teacherActions ?? []
          const hasAdjustments   = kPlanAdjustments.length > 0 || ehcpSectionF.length > 0

          return (
            <div key={row.id}>
              {/* ── Collapsed row ── */}
              <div
                onClick={() => handleToggle(row)}
                className="w-full flex items-start gap-3 px-4 py-2.5 bg-white text-left cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <button
                  type="button"
                  title="View student contact details"
                  onClick={e => { e.stopPropagation(); setContactStudentId(row.id) }}
                  className="shrink-0 rounded-full ring-0 hover:ring-2 hover:ring-blue-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <StudentAvatar
                    firstName={row.firstName}
                    lastName={row.lastName}
                    avatarUrl={row.avatarUrl}
                    size="sm"
                    sendStatus={row.sendStatus as 'NONE' | 'SEN_SUPPORT' | 'EHCP'}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  {/* Name + year + doc badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setContactStudentId(row.id) }}
                      className="text-[13px] font-medium text-gray-900 truncate hover:text-blue-600 transition-colors text-left"
                    >
                      {row.firstName} {row.lastName}
                    </button>
                    {row.yearGroup != null && (
                      <span className="text-[10px] text-gray-400 font-medium">Year {row.yearGroup}</span>
                    )}
                    {/* Doc badges */}
                    {row.hasIlp && (
                      <button
                        type="button"
                        title="ILP — click to view"
                        onClick={e => handleDocBadge(e, row, 'ilp')}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors shrink-0"
                      >
                        <span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>description</span>
                        ILP
                      </button>
                    )}
                    {row.hasEhcp && (
                      <button
                        type="button"
                        title="EHCP — click to view"
                        onClick={e => handleDocBadge(e, row, 'ehcp')}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors shrink-0"
                      >
                        <span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>description</span>
                        EHCP
                      </button>
                    )}
                    {kPlan && (
                      <button
                        type="button"
                        title="K Plan — click to view"
                        onClick={e => handleDocBadge(e, row, 'kplan')}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors shrink-0"
                      >
                        <span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>description</span>
                        K Plan
                      </button>
                    )}
                  </div>
                  {row.needArea && (
                    <p className="text-[10px] text-gray-400 truncate">{row.needArea}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {/* RAG dot */}
                  {ragStudent && ragStudent.ragStatus !== 'no_data' && (
                    <span
                      title={`RAG: ${ragStudent.ragStatus}`}
                      className={`w-2 h-2 rounded-full shrink-0 ${RAG_DOT[ragStudent.ragStatus]}`}
                    />
                  )}
                  {badge && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                  {scoreDisplay && (
                    <span className="text-[11px] font-medium text-gray-500 w-12 text-right">
                      {scoreDisplay}
                    </span>
                  )}
                  {/* Chevron for all students */}
                  {isExpanded
                    ? <Icon name="expand_more"  size="sm" className="text-gray-400 shrink-0" />
                    : <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0" />
                  }
                </div>
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-5">

                  {/* Support snapshot */}
                  {row.supportSnapshot && (
                    <p className="text-[12px] text-amber-800 italic leading-snug border-l-2 border-amber-300 pl-2.5">
                      {row.supportSnapshot}
                    </p>
                  )}

                  {/* Section 1 — Classroom Adjustments (SEND only) */}
                  {isSend && (hasAdjustments || (row.sendStatus === 'EHCP' && ehcpData === 'loading')) && (
                    <section>
                      <p className={SECTION_HEADING}>Classroom Adjustments</p>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        {row.sendStatus === 'EHCP' && ehcpData === 'loading' && kPlanAdjustments.length === 0 ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {kPlanAdjustments.length > 0 && (
                              <div>
                                <p className="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1.5">K Plan</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {kPlanAdjustments.map((action, i) => (
                                    <span key={i} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium leading-snug">
                                      {action}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {ehcpSectionF.length > 0 && (
                              <div>
                                <p className="text-[9px] font-semibold text-purple-600 uppercase tracking-wide mb-1.5">EHCP Section F</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ehcpSectionF.map((provision, i) => (
                                    <span key={i} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium leading-snug">
                                      {provision}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Section 2 — ILP Smart Goals (SEND only) */}
                  {isSend && row.hasIlp && (
                    <section>
                      <p className={SECTION_HEADING}>ILP Smart Goals</p>
                      {ilpData === 'loading' ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                        </div>
                      ) : !ilpData || ilpData.targets.length === 0 ? (
                        <p className="text-[12px] text-gray-400 italic">No active ILP targets.</p>
                      ) : (
                        <div className="space-y-2">
                          {ilpData.targets.slice(0, 3).map((t, i) => (
                            <div key={t.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[12px] font-medium text-gray-800">{i + 1}. {t.target}</p>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${TARGET_STATUS_CLS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {t.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">{t.strategy}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Section 3 — Documents */}
                  {isSend && (row.hasIlp || row.hasEhcp || !!kPlan) && (
                    <section>
                      <p className={SECTION_HEADING}>Documents</p>
                      <div className="flex flex-wrap gap-2">
                        {row.hasIlp && (
                          <button
                            type="button"
                            onClick={() => setDocSlideOver({ studentId: row.id, studentName, docType: 'ilp' })}
                            className="flex items-center gap-2 px-3 py-2 border border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors text-left"
                          >
                            <span className="material-icons text-blue-500" style={{ fontSize: '18px' }}>description</span>
                            <div>
                              <p className="text-[11px] font-semibold text-blue-700">ILP</p>
                              <p className="text-[10px] text-gray-400">
                                {ilpData && ilpData !== 'loading' ? ilpData.status.replace(/_/g, ' ') : '—'}
                              </p>
                            </div>
                            <span className="text-[10px] text-blue-400 ml-1">Open →</span>
                          </button>
                        )}
                        {row.hasEhcp && (
                          <button
                            type="button"
                            onClick={() => setDocSlideOver({ studentId: row.id, studentName, docType: 'ehcp' })}
                            className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-xl bg-white hover:bg-purple-50 transition-colors text-left"
                          >
                            <span className="material-icons text-purple-500" style={{ fontSize: '18px' }}>verified_user</span>
                            <div>
                              <p className="text-[11px] font-semibold text-purple-700">EHCP</p>
                              <p className="text-[10px] text-gray-400">
                                {ehcpData && ehcpData !== 'loading' ? ehcpData.status.replace(/_/g, ' ') : '—'}
                              </p>
                            </div>
                            <span className="text-[10px] text-purple-400 ml-1">Open →</span>
                          </button>
                        )}
                        {kPlan && (
                          <button
                            type="button"
                            onClick={() => setDocSlideOver({ studentId: row.id, studentName, docType: 'kplan' })}
                            className="flex items-center gap-2 px-3 py-2 border border-green-200 rounded-xl bg-white hover:bg-green-50 transition-colors text-left"
                          >
                            <span className="material-icons text-green-500" style={{ fontSize: '18px' }}>menu_book</span>
                            <div>
                              <p className="text-[11px] font-semibold text-green-700">K Plan</p>
                              <p className="text-[10px] text-gray-400 capitalize">{kPlan.status.toLowerCase()}</p>
                            </div>
                            <span className="text-[10px] text-green-400 ml-1">Open →</span>
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Section 4 — Recent Homework */}
                  <section>
                    <p className={SECTION_HEADING}>Recent Homework</p>
                    {!detail || detail === 'loading' ? (
                      <div className="flex items-center gap-2 text-[12px] text-gray-400">
                        <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                      </div>
                    ) : detail.recentSubmissions.length === 0 ? (
                      <p className="text-[12px] text-gray-400 italic">No recent homework for this class.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.recentSubmissions.slice(0, 3).map((s, i) => {
                          const score    = s.finalScore ?? s.autoScore
                          const scoreStr = score != null
                            ? (s.maxScore ? `${Math.round(score)}/${s.maxScore}` : `${Math.round(score)}`)
                            : null
                          const pct = score != null && s.maxScore ? Math.round((score / s.maxScore) * 100) : score
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-[12px] text-gray-700 flex-1 truncate">{s.homeworkTitle}</span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(s.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-500'}`}>
                                {s.status.charAt(0) + s.status.slice(1).toLowerCase().replace(/_/g, ' ')}
                              </span>
                              {scoreStr != null && (
                                <span className={`text-[11px] font-bold shrink-0 w-12 text-right ${pct != null && pct >= 70 ? 'text-green-600' : pct != null && pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {scoreStr}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Section 5 — Exam & Test Scores */}
                  <section>
                    <p className={SECTION_HEADING}>Exam &amp; Test Scores</p>
                    {!rosterDetail || rosterDetail === 'loading' ? (
                      <div className="flex items-center gap-2 text-[12px] text-gray-400">
                        <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                      </div>
                    ) : rosterDetail.examScores.length === 0 ? (
                      <p className="text-[12px] text-gray-400 italic">No test or exam records found.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {rosterDetail.examScores.slice(0, 5).map((s, i) => {
                          const pct = s.score != null && s.maxScore ? Math.round((s.score / s.maxScore) * 100) : null
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-[12px] text-gray-700 flex-1 truncate">{s.title}</span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(s.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                              {s.score != null ? (
                                <span className={`text-[11px] font-bold shrink-0 ${pct != null && pct >= 70 ? 'text-green-600' : pct != null && pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {s.score}/{s.maxScore}
                                  {s.grade && <span className="ml-1 text-gray-400">(G{s.grade})</span>}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">Not marked</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Section 6 — Teacher Notes */}
                  <section>
                    <p className={SECTION_HEADING}>Teacher Notes</p>
                    {rosterDetail && rosterDetail !== 'loading' && rosterDetail.rosterNotes.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {rosterDetail.rosterNotes.map(n => (
                          <div key={n.id} className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-yellow-600 font-medium mb-0.5">
                              {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-[12px] text-gray-700 leading-relaxed">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <textarea
                        value={newNotes[row.id] ?? ''}
                        onChange={e => setNewNotes(n => ({ ...n, [row.id]: e.target.value }))}
                        placeholder="Add a note about this student…"
                        rows={3}
                        className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNote(row.id)}
                        disabled={savingNote === row.id || !newNotes[row.id]?.trim()}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {savingNote === row.id
                          ? <Icon name="refresh" size="sm" className="animate-spin" />
                          : <Icon name="sticky_note_2" size="sm" />
                        }
                        Add note
                      </button>
                    </div>
                  </section>

                  {/* Section 7 — Progress vs Predicted */}
                  <section>
                    <p className={SECTION_HEADING}>Progress vs Predicted</p>
                    {!ragStudent || (ragStudent.workingAtScore == null && ragStudent.prediction == null) ? (
                      <p className="text-[12px] text-gray-400 italic">No predictions set for this term.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {ragStudent.prediction && (
                          <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Predicted</p>
                            <p className="text-[14px] font-bold text-gray-900">
                              {ragStudent.prediction.effectiveScore}%
                              <span className="text-[11px] font-normal text-gray-500 ml-1">
                                Grade {percentToGcseGrade(ragStudent.prediction.effectiveScore)}
                              </span>
                            </p>
                          </div>
                        )}
                        {ragStudent.workingAtScore != null && (
                          <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Working At</p>
                            <p className="text-[14px] font-bold text-gray-900">
                              {ragStudent.workingAtScore}%
                              <span className="text-[11px] font-normal text-gray-500 ml-1">
                                Grade {percentToGcseGrade(ragStudent.workingAtScore)}
                              </span>
                            </p>
                          </div>
                        )}
                        {ragStudent.lastScore != null && (
                          <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Last Score</p>
                            <p className="text-[14px] font-bold text-gray-900">{ragStudent.lastScore}%</p>
                          </div>
                        )}
                        <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full shrink-0 ${RAG_DOT[ragStudent.ragStatus]}`} />
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">RAG</p>
                            <p className="text-[13px] font-semibold text-gray-700 capitalize">{ragStudent.ragStatus.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* APDR panel (SEND only) */}
                  {isSend && (
                    <section>
                      <p className={SECTION_HEADING}>APDR</p>
                      <StudentAPDRPanel studentId={row.id} userRole={userRole} />
                    </section>
                  )}

                  {/* K Plan interactive checklist (SEND only) */}
                  {isSend && kPlan && (() => {
                    const fullPassport = kPlanFullCache[row.id]
                    const checked      = kPlanChecked[row.id] ?? []
                    if (!fullPassport) {
                      loadKPlanFull(row.id)
                    }

                    function toggleCheck(i: number) {
                      setKPlanChecked(ch => {
                        const arr = [...(ch[row.id] ?? [])]
                        arr[i] = !arr[i]
                        return { ...ch, [row.id]: arr }
                      })
                    }

                    return (
                      <section>
                        <p className={SECTION_HEADING}>K Plan Quick-view</p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">SEND Information</p>
                            <p className="text-[12px] text-gray-700 leading-relaxed line-clamp-3">{kPlan.sendInformation}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-purple-500 uppercase tracking-wide mb-1.5">
                              It would help me if you could
                              <span className="ml-1.5 text-gray-400 normal-case font-normal">(tick as reminders — not saved)</span>
                            </p>
                            {fullPassport === 'loading' ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                              </div>
                            ) : fullPassport ? (
                              <ul className="space-y-1.5">
                                {fullPassport.teacherActions.map((action, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked[i] ?? false}
                                      onChange={() => toggleCheck(i)}
                                      className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-purple-600 cursor-pointer"
                                    />
                                    <span className={`text-[12px] leading-snug ${checked[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                      {action}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[12px] text-gray-400 italic">Could not load actions.</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openKPlanModal(row.id, studentName)}
                              disabled={kPlanLoading === row.id}
                              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              {kPlanLoading === row.id
                                ? <Icon name="refresh" size="sm" className="animate-spin" />
                                : <Icon name="menu_book" size="sm" />
                              }
                              Full view
                            </button>
                          </div>
                        </div>
                      </section>
                    )
                  })()}

                  {/* View full SEND plan link (SEND only) */}
                  {isSend && (
                    <a
                      href={`/student/${row.id}/send`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      View full SEND plan <Icon name="chevron_right" size="sm" />
                    </a>
                  )}

                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* K Plan Modal */}
      {kPlanModal && (
        <KPlanModal
          passport={kPlanModal.passport}
          studentName={kPlanModal.studentName}
          studentId={kPlanModal.studentId}
          userRole={userRole}
          onClose={() => setKPlanModal(null)}
          onUpdated={() => { setKPlanModal(null); refreshKPlanMap() }}
        />
      )}

      {/* Student contact panel */}
      <StudentContactPanel
        studentId={contactStudentId}
        onClose={() => setContactStudentId(null)}
        zIndex={70}
      />

      {/* Doc slide-over */}
      {docSlideOver && (
        <DocSlideOver
          studentId={docSlideOver.studentId}
          studentName={docSlideOver.studentName}
          docType={docSlideOver.docType}
          onClose={() => setDocSlideOver(null)}
        />
      )}

    </div>
  )
}
