'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Icon from '@/components/ui/Icon'
import { getClassRoster, getStudentClassDetail, type ClassRosterRow, type StudentClassDetail } from '@/app/actions/lessons'
import {
  getCurrentUserRole,
  getClassKPlanSummaries,
  getStudentLearnerPassport,
  getStudentIlp,
  type LearnerPassportRow,
  type IlpWithTargets,
} from '@/app/actions/send-support'
import StudentAvatar from '@/components/StudentAvatar'
import StudentContactPanel from '@/components/StudentContactPanel'

const StudentAPDRPanel       = dynamic(() => import('@/components/send-support/StudentAPDRPanel'), { ssr: false })
const KPlanModal             = dynamic(() => import('@/components/send-support/KPlanModal'),       { ssr: false })
const SendDocumentThumbnails = dynamic(() => import('@/components/send/SendDocumentThumbnails'),  { ssr: false })

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
  RETURNED:           'bg-green-100 text-green-700',
  MARKED:             'bg-blue-100 text-blue-700',
  UNDER_REVIEW:       'bg-amber-100 text-amber-700',
  RESUBMISSION_REQ:   'bg-orange-100 text-orange-700',
  SUBMITTED:          'bg-gray-100 text-gray-600',
}

type KPlanSummary = { id: string; sendInformation: string; status: string; teacherActions: string[] }

export default function ClassRosterTab({ classId }: { classId: string }) {
  const [rows,            setRows]           = useState<ClassRosterRow[]>([])
  const [loading,         setLoading]        = useState(true)
  const [error,           setError]          = useState<string | null>(null)
  const [expandedId,      setExpandedId]     = useState<string | null>(null)
  const [contactStudentId, setContactStudentId] = useState<string | null>(null)
  const [detailsCache,    setDetailsCache]   = useState<Record<string, StudentClassDetail | 'loading'>>({})
  const [ilpCache,        setIlpCache]       = useState<Record<string, IlpWithTargets | 'loading' | null>>({})
  const [userRole,        setUserRole]       = useState<string>('TEACHER')
  const [activeTab,       setActiveTab]      = useState<Record<string, 'homework' | 'apdr' | 'kplan'>>({})
  const [kPlanMap,        setKPlanMap]       = useState<Record<string, KPlanSummary>>({})
  const [kPlanModal,      setKPlanModal]     = useState<{ studentId: string; studentName: string; passport: LearnerPassportRow } | null>(null)
  const [kPlanLoading,    setKPlanLoading]   = useState<string | null>(null)
  const [kPlanFullCache,  setKPlanFullCache] = useState<Record<string, LearnerPassportRow | 'loading'>>({})
  const [kPlanChecked,    setKPlanChecked]   = useState<Record<string, boolean[]>>({})

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getClassRoster(classId),
      getCurrentUserRole(),
      getClassKPlanSummaries(classId),
    ])
      .then(([r, role, kplans]) => { setRows(r); setUserRole(role ?? 'TEACHER'); setKPlanMap(kplans) })
      .catch(() => setError('Could not load class roster.'))
      .finally(() => setLoading(false))
  }, [classId])

  function handleToggle(row: ClassRosterRow) {
    // Only SEND students can expand
    if (row.sendStatus === 'NONE') return
    const id = row.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!activeTab[id]) setActiveTab(t => ({ ...t, [id]: 'homework' }))
    // Load homework detail
    if (!detailsCache[id]) {
      setDetailsCache(c => ({ ...c, [id]: 'loading' }))
      getStudentClassDetail(id, classId)
        .then(d  => setDetailsCache(c => ({ ...c, [id]: d })))
        .catch(() => setDetailsCache(c => ({ ...c, [id]: { recentSubmissions: [] } })))
    }
    // Load ILP targets
    if (!ilpCache[id]) {
      setIlpCache(c => ({ ...c, [id]: 'loading' }))
      getStudentIlp(id)
        .then(ilp => setIlpCache(c => ({ ...c, [id]: ilp })))
        .catch(() => setIlpCache(c => ({ ...c, [id]: null })))
    }
  }

  function setTab(studentId: string, tab: 'homework' | 'apdr' | 'kplan') {
    setActiveTab(t => ({ ...t, [studentId]: tab }))
    if (tab === 'kplan' && !kPlanFullCache[studentId]) {
      setKPlanFullCache(c => ({ ...c, [studentId]: 'loading' }))
      getStudentLearnerPassport(studentId)
        .then(p => {
          setKPlanFullCache(c => ({ ...c, [studentId]: p ?? ('loading' as any) }))
          if (p) setKPlanChecked(ch => ({ ...ch, [studentId]: new Array(p.teacherActions.length).fill(false) }))
        })
        .catch(() => setKPlanFullCache(c => ({ ...c, [studentId]: 'loading' })))
    }
  }

  async function openKPlanModal(studentId: string, studentName: string) {
    setKPlanLoading(studentId)
    try {
      const passport = await getStudentLearnerPassport(studentId)
      if (passport) setKPlanModal({ studentId, studentName, passport })
    } finally {
      setKPlanLoading(null)
    }
  }

  function refreshKPlanMap() {
    getClassKPlanSummaries(classId).then(setKPlanMap).catch(() => {})
  }

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
          const studentName  = `${row.firstName} ${row.lastName}`

          return (
            <div key={row.id}>
              {/* Row */}
              <div
                onClick={() => handleToggle(row)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 bg-white text-left ${isSend ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
              >
                {/* Avatar — click to open contact panel (stop propagation to avoid SEND expand) */}
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
                  {/* Name — click to open contact panel */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setContactStudentId(row.id) }}
                    className="text-[13px] font-medium text-gray-900 truncate hover:text-blue-600 transition-colors text-left w-full"
                  >
                    {row.firstName} {row.lastName}
                  </button>
                  {row.needArea && (
                    <p className="text-[10px] text-gray-400 truncate">{row.needArea}</p>
                  )}
                  {/* K Plan at-a-glance bullets — top 4 teacher actions */}
                  {kPlan?.teacherActions && kPlan.teacherActions.length > 0 && (
                    <ul className="mt-0.5 space-y-0">
                      {kPlan.teacherActions.slice(0, 4).map((action, i) => (
                        <li key={i} className="flex items-start gap-1 text-[10px] text-teal-700 leading-snug">
                          <span className="mt-[3px] shrink-0 w-1 h-1 rounded-full bg-teal-400 inline-block" />
                          <span className="truncate">{action}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {badge && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                  {row.hasIlp && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      ILP
                    </span>
                  )}
                  {kPlan && kPlan.status === 'APPROVED' && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                      <Icon name="menu_book" size="sm" /> K Plan
                    </span>
                  )}
                  {scoreDisplay && (
                    <span className="text-[11px] font-medium text-gray-500 w-12 text-right">
                      {scoreDisplay}
                    </span>
                  )}
                  {/* Only SEND students have an expand chevron */}
                  {isSend && (
                    isExpanded
                      ? <Icon name="expand_more"  size="sm" className="text-gray-400 shrink-0" />
                      : <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0" />
                  )}
                </div>
              </div>

              {/* Expanded SEND detail — only for SEND students */}
              {isExpanded && isSend && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-4">

                  {/* Support snapshot */}
                  {row.supportSnapshot && (
                    <p className="text-[12px] text-amber-800 italic leading-snug border-l-2 border-amber-300 pl-2.5">
                      {row.supportSnapshot}
                    </p>
                  )}

                  {/* ILP SMART goals */}
                  <div>
                    <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-2">
                      ILP Smart Goals
                    </p>
                    {ilpData === 'loading' ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                      </div>
                    ) : !ilpData || ilpData.targets.length === 0 ? (
                      <p className="text-[12px] text-gray-400 italic">No ILP targets on record.</p>
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
                  </div>

                  {/* EHCP Section F provisions */}
                  {row.sendStatus === 'EHCP' && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1">
                        EHCP Provisions
                      </p>
                      <p className="text-[12px] text-purple-700">
                        Open the EHCP document below to view Section F provisions.
                      </p>
                    </div>
                  )}

                  {/* Document thumbnails */}
                  <SendDocumentThumbnails
                    studentId={row.id}
                    studentName={studentName}
                    userRole={userRole}
                  />

                  {/* "View full plan" link */}
                  <a
                    href={`/student/${row.id}/send`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View full plan <Icon name="chevron_right" size="sm" />
                  </a>

                  {/* Homework / APDR / K Plan tabs */}
                  <div>
                    <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden w-fit mb-3">
                      {(['homework', 'apdr', 'kplan'] as const).map(tab => {
                        const label    = tab === 'homework' ? 'Homework' : tab === 'apdr' ? 'APDR' : 'K Plan'
                        const isActive = (activeTab[row.id] ?? 'homework') === tab
                        return (
                          <button
                            key={tab}
                            onClick={() => setTab(row.id, tab)}
                            className={`text-[11px] font-medium px-3 py-1 transition-colors ${
                              isActive ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {label}
                            {tab === 'kplan' && kPlan?.status === 'APPROVED' && (
                              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Homework tab */}
                    {(activeTab[row.id] ?? 'homework') === 'homework' && (
                      <div>
                        {detail === 'loading' ? (
                          <div className="flex items-center gap-2 text-[12px] text-gray-400">
                            <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
                          </div>
                        ) : !detail || detail.recentSubmissions.length === 0 ? (
                          <p className="text-[12px] text-gray-400">No submissions for this class yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {detail.recentSubmissions.map((s, i) => {
                              const score    = s.finalScore ?? s.autoScore
                              const scoreStr = score != null
                                ? (s.maxScore ? `${Math.round(score)}/${s.maxScore}` : `${Math.round(score)}`)
                                : null
                              const pct = score != null && s.maxScore ? Math.round((score / s.maxScore) * 100) : score
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-[12px] text-gray-700 flex-1 truncate">{s.homeworkTitle}</span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-500'}`}>
                                    {s.status.charAt(0) + s.status.slice(1).toLowerCase().replace('_', ' ')}
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
                      </div>
                    )}

                    {/* APDR tab */}
                    {(activeTab[row.id] ?? 'homework') === 'apdr' && (
                      <StudentAPDRPanel studentId={row.id} userRole={userRole} />
                    )}

                    {/* K Plan tab */}
                    {(activeTab[row.id] ?? 'homework') === 'kplan' && (() => {
                      if (!kPlan) return (
                        <p className="text-[12px] text-gray-400 italic">No approved K Plan for this student.</p>
                      )
                      const fullPassport = kPlanFullCache[row.id]
                      const checked      = kPlanChecked[row.id] ?? []

                      function toggleCheck(i: number) {
                        setKPlanChecked(ch => {
                          const arr = [...(ch[row.id] ?? [])]
                          arr[i] = !arr[i]
                          return { ...ch, [row.id]: arr }
                        })
                      }

                      return (
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">SEND Information</p>
                            <p className="text-[12px] text-gray-700 leading-relaxed line-clamp-3">{kPlan.sendInformation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide mb-1.5">
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
                          {fullPassport && fullPassport !== 'loading' && fullPassport.studentCommitments.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1.5">
                                {row.firstName} will help themselves by
                              </p>
                              <ul className="space-y-1">
                                {fullPassport.studentCommitments.map((c, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => openKPlanModal(row.id, studentName)}
                              disabled={kPlanLoading === row.id}
                              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              {kPlanLoading === row.id ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="menu_book" size="sm" />}
                              Full view
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

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

      {/* Student contact panel — z-[70] to sit above LessonFolder (z-[60]) */}
      <StudentContactPanel
        studentId={contactStudentId}
        onClose={() => setContactStudentId(null)}
        zIndex={70}
      />
    </div>
  )
}
