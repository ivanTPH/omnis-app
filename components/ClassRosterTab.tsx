'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { StudentListSkeleton } from '@/components/ui/skeletons'
import Tooltip from '@/components/ui/Tooltip'
import SendBadge from '@/components/ui/SendBadge'
import { raiseConcern } from '@/app/actions/send-support'
import { percentToGcseGrade, gradeLabel } from '@/lib/grading'
import StudentAvatar from '@/components/StudentAvatar'
import StudentContactPanel from '@/components/StudentContactPanel'
import { useClassRosterData, type ExpandedTabKey } from '@/hooks/useClassRosterData'
import { useState } from 'react'
import type { ClassRosterRow } from '@/app/actions/lessons'

const StudentAPDRPanel = dynamic(() => import('@/components/send-support/StudentAPDRPanel'), { ssr: false })
const KPlanModal       = dynamic(() => import('@/components/send-support/KPlanModal'),       { ssr: false })
const DocSlideOver     = dynamic(() => import('@/components/send/DocSlideOver'),             { ssr: false })

// ── Constants ─────────────────────────────────────────────────────────────────

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

const EXPANDED_TABS: { key: ExpandedTabKey; label: string }[] = [
  { key: 'overview',    label: 'Overview'    },
  { key: 'plans',       label: 'Plans'       },
  { key: 'homework',    label: 'Homework'    },
  { key: 'assessments', label: 'Assessments' },
  { key: 'notes',       label: 'Notes'       },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClassRosterTab({
  classId,
  externalSearch,
  showCheckboxes,
  onSelectionChange,
}: {
  classId: string
  externalSearch?: string
  showCheckboxes?: boolean
  onSelectionChange?: (ids: string[]) => void
}) {
  const {
    rows, loading, error, userRole,
    kPlanMap, ragMap, ehcpTipsMap,
    detailsCache, ilpCache, ehcpCache, rosterDetailCache, taNoteCache, adaptiveProfileCache,
    kPlanFullCache, kPlanChecked, kPlanLoading, kPlanModal, generatingIlp, ilpError,
    newNotes, savingNote, docSlideOver, flagConcernStudent,
    expandedId, expandedTab, selectedIds, searchQuery, sendFilter, contactStudentId,
    setExpandedId, setExpandedTab, setSelectedIds,
    setSearchQuery, setSendFilter, setContactStudentId,
    setDocSlideOver, setFlagConcernStudent, setKPlanModal, setKPlanChecked,
    setNewNotes, setIlpError,
    handleToggle, handleDocBadge, handleSaveNote, handleGenerateIlp,
    openKPlanModal, refreshKPlanMap, loadKPlanFull,
  } = useClassRosterData(classId, onSelectionChange)

  // ── Early returns ──────────────────────────────────────────────────────────

  if (loading) return <StudentListSkeleton />

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 py-8 justify-center text-[13px]">
        <Icon name="error" size="sm" /> {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="groups"
        title="No students enrolled"
        description="No active students are enrolled in this class. Contact your administrator if this looks wrong."
        size="sm"
      />
    )
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  const senSupportCount = rows.filter(r => r.sendStatus === 'SEN_SUPPORT').length
  const ehcpCount       = rows.filter(r => r.sendStatus === 'EHCP').length
  const sendCount       = senSupportCount + ehcpCount
  const ilpCount        = rows.filter(r => r.hasIlp).length

  // ── Row filter ────────────────────────────────────────────────────────────

  function matchesFilter(row: ClassRosterRow) {
    const q = externalSearch ?? searchQuery
    const matchesSend = sendFilter === 'ALL' ? true
      : sendFilter === 'NO_PLAN'     ? (row.sendStatus === 'SEN_SUPPORT' || row.sendStatus === 'EHCP') && !row.hasIlp
      : sendFilter === 'NO_PASSPORT' ? !row.hasLearningProfile
      : row.sendStatus === sendFilter
    return matchesSend && (!q || `${row.firstName} ${row.lastName}`.toLowerCase().includes(q.toLowerCase()))
  }

  const filteredRows    = rows.filter(matchesFilter)
  const filteredIds     = filteredRows.map(r => r.id)
  const allFilteredSel  = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id))
  const someFilteredSel = selectedIds.some(id => filteredIds.includes(id))

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <Link href="/senco/dashboard" className="text-[11px] text-blue-500 hover:text-blue-700 mt-0.5 inline-block">
              View SEND dashboard →
            </Link>
          </div>
        </div>
      )}

      {/* Search + SEND filter */}
      <div className="flex flex-wrap items-center gap-2">
        {externalSearch === undefined && (
          <div className="relative flex-1 min-w-[160px]">
            <Icon name="search" size="sm" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search students…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        {(['ALL', 'SEN_SUPPORT', 'EHCP', 'NO_PLAN', 'NO_PASSPORT'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setSendFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              sendFilter === f
                ? f === 'NO_PLAN' ? 'bg-amber-500 text-white'
                  : f === 'NO_PASSPORT' ? 'bg-violet-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'SEN_SUPPORT' ? 'SEN Support' : f === 'EHCP' ? 'EHCP' : f === 'NO_PLAN' ? 'No Plan' : 'No Passport'}
          </button>
        ))}
        <span className="text-[11px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium ml-auto">
          {filteredRows.length} / {rows.length} students
        </span>
      </div>

      {sendFilter === 'NO_PLAN' && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-[12px] text-amber-800">
          <Icon name="info" size="sm" className="text-amber-500 shrink-0" />
          Students with SEND status but no active ILP. Click <strong>Generate ILP</strong> to create one.
        </div>
      )}
      {ilpError && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-[12px] text-red-700">
          <Icon name="error" size="sm" className="text-red-500 shrink-0" />
          {ilpError}
          <button onClick={() => setIlpError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}
      {sendFilter === 'NO_PASSPORT' && (
        <div className="mb-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl flex items-start gap-2 text-[12px] text-violet-800">
          <Icon name="info" size="sm" className="text-violet-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            Students without a Learning Passport.
            {showCheckboxes && filteredRows.length > 0 && (
              <>
                {' '}
                {!allFilteredSel ? (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(prev => [...new Set([...prev, ...filteredIds])])}
                    className="font-semibold underline hover:text-violet-900"
                  >
                    Select all {filteredRows.length}
                  </button>
                ) : (
                  <span className="font-semibold text-violet-700">All selected</span>
                )}
                {' '}then click <strong>Generate Passports</strong> above.
              </>
            )}
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className={`grid ${showCheckboxes ? 'grid-cols-[24px_1fr_90px_110px_80px_40px_30px]' : 'grid-cols-[1fr_90px_110px_80px_40px_30px]'} items-center gap-x-2 px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-t-xl border-b-0 text-[10px] text-gray-400 font-semibold uppercase tracking-wide`}>
        {showCheckboxes && (
          <input
            type="checkbox"
            checked={allFilteredSel}
            ref={el => { if (el) el.indeterminate = !allFilteredSel && someFilteredSel }}
            onChange={e => {
              if (e.target.checked) setSelectedIds(prev => [...new Set([...prev, ...filteredIds])])
              else setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)))
            }}
            className="rounded border-gray-300 text-blue-700 focus:ring-blue-700"
          />
        )}
        <span>Student</span>
        <span className="text-center">RAG</span>
        <span>SEND</span>
        <span>Latest</span>
        <span></span>
        <span></span>
      </div>

      {/* Student rows */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-b-xl overflow-hidden">
        {filteredRows.map(row => {
          const isSend       = row.sendStatus !== 'NONE'
          const scoreDisplay = row.latestScore != null
            ? gradeLabel(percentToGcseGrade(
                row.maxScore ? Math.round((row.latestScore / row.maxScore) * 100) : Math.round(row.latestScore)
              ))
            : null
          const isExpanded   = expandedId === row.id
          const detail       = detailsCache[row.id]
          const ilpData      = ilpCache[row.id]
          const kPlan        = kPlanMap[row.id]
          const ehcpData     = ehcpCache[row.id]
          const rosterDetail    = rosterDetailCache[row.id]
          const ragStudent      = ragMap[row.id]
          const adaptiveProfile = adaptiveProfileCache[row.id]
          const studentName     = `${row.firstName} ${row.lastName}`
          const activeTab    = expandedTab[row.id] ?? 'overview'

          const ehcpSectionF = ehcpData && ehcpData !== 'loading' && ehcpData.sections?.F
            ? ehcpData.sections.F.split(/\n+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
            : []
          const kPlanAdjustments = kPlan?.teacherActions ?? []
          const hasAdjustments   = kPlanAdjustments.length > 0 || ehcpSectionF.length > 0
          const kPlanTips        = kPlanAdjustments.slice(0, 2)
          const ehcpFallbackTips = ehcpTipsMap[row.id]?.slice(0, 2) ?? []
          const quickTip         = (kPlanTips.length > 0 ? kPlanTips : ehcpFallbackTips).join(' · ') || null
          const ragStatus        = ragStudent?.ragStatus ?? 'no_data'

          return (
            <div key={row.id}>
              {/* ── Collapsed row ── */}
              <div
                onClick={() => handleToggle(row)}
                className={`w-full grid ${showCheckboxes ? 'grid-cols-[24px_1fr_90px_110px_80px_40px_30px]' : 'grid-cols-[1fr_90px_110px_80px_40px_30px]'} items-center gap-x-2 px-4 py-2.5 bg-white text-left cursor-pointer hover:bg-gray-50 transition-colors`}
              >
                {showCheckboxes && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={e => {
                      e.stopPropagation()
                      if (e.target.checked) setSelectedIds(prev => [...prev, row.id])
                      else setSelectedIds(prev => prev.filter(id => id !== row.id))
                    }}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-gray-300 text-blue-700 focus:ring-blue-700"
                  />
                )}

                {/* Col 1: Avatar + name */}
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    title="View student contact details"
                    onClick={e => { e.stopPropagation(); setContactStudentId(row.id) }}
                    className="shrink-0 rounded-full ring-0 hover:ring-2 hover:ring-blue-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <StudentAvatar
                      firstName={row.firstName} lastName={row.lastName}
                      avatarUrl={row.avatarUrl} size="sm"
                      sendStatus={row.sendStatus as 'NONE' | 'SEN_SUPPORT' | 'EHCP'}
                      userId={row.id}
                    />
                  </button>
                  <div className="min-w-0">
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
                    </div>
                    {quickTip != null && (
                      <p className="text-[11px] text-gray-400 italic truncate max-w-[160px]">{quickTip}</p>
                    )}
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      {row.hasIlp && (
                        <button type="button" title="ILP — click to view" onClick={e => handleDocBadge(e, row, 'ilp')}
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors shrink-0">
                          <span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>description</span>ILP
                        </button>
                      )}
                      {row.hasEhcp && (
                        <button type="button" title="EHCP — click to view" onClick={e => handleDocBadge(e, row, 'ehcp')}
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors shrink-0">
                          <span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>description</span>EHCP
                        </button>
                      )}
                      {kPlan && (
                        <button type="button" title="K Plan — click to view" onClick={e => handleDocBadge(e, row, 'kplan')}
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors shrink-0">
                          <span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>description</span>K Plan
                        </button>
                      )}
                      {sendFilter === 'NO_PLAN' && !row.hasIlp && (
                        <button
                          type="button"
                          title="Generate ILP for this student"
                          disabled={!!generatingIlp[row.id]}
                          onClick={e => { e.stopPropagation(); handleGenerateIlp(row.id) }}
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors shrink-0 disabled:opacity-50"
                        >
                          {generatingIlp[row.id]
                            ? <><span className="material-icons animate-spin" style={{ fontSize: '11px', lineHeight: 1 }}>refresh</span>Generating…</>
                            : <><span className="material-icons" style={{ fontSize: '11px', lineHeight: 1 }}>auto_fix_high</span>Generate ILP</>
                          }
                        </button>
                      )}
                    </div>
                    {row.needArea && <p className="text-[10px] text-gray-400 truncate mt-0.5">{row.needArea}</p>}
                  </div>
                </div>

                {/* Col 2: RAG */}
                <div className="flex flex-col items-center gap-0.5">
                  <Tooltip
                    content={
                      ragStatus === 'no_data' ? 'No homework data yet'
                        : ragStatus === 'green' ? 'On Track — at or above predicted grade'
                        : ragStatus === 'amber' ? 'Developing — 1 grade below predicted'
                        : 'Needs Attention — 2+ grades below predicted'
                    }
                    side="left"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${RAG_DOT[ragStatus]}`} />
                  </Tooltip>
                  {ragStatus !== 'no_data' && (
                    <span className={`text-[8px] font-semibold leading-none whitespace-nowrap ${
                      ragStatus === 'green' ? 'text-green-600' : ragStatus === 'amber' ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {ragStatus === 'green' ? 'On Track' : ragStatus === 'amber' ? 'Developing' : 'Attention'}
                    </span>
                  )}
                </div>

                {/* Col 3: SEND badge */}
                <div className="flex justify-center">
                  {isSend && (
                    <Tooltip content={row.sendStatus === 'EHCP' ? 'Education, Health and Care Plan — statutory SEND support' : 'SEN Support — school-based SEND provision'} side="left">
                      <SendBadge status={row.sendStatus as 'EHCP' | 'SEN_SUPPORT'} showTier />
                    </Tooltip>
                  )}
                </div>

                {/* Col 4: Grade */}
                <div className="text-right">
                  {scoreDisplay && <span className="text-[11px] font-medium text-gray-500">{scoreDisplay}</span>}
                </div>

                {/* Col 5: Flag concern */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    title="Flag a SEND concern for this student"
                    onClick={e => { e.stopPropagation(); setFlagConcernStudent({ id: row.id, name: studentName }) }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-amber-50 text-gray-300 hover:text-amber-500 transition-colors"
                  >
                    <Icon name="flag" size="sm" />
                  </button>
                </div>

                {/* Col 6: Chevron */}
                <div className="flex justify-center">
                  {isExpanded
                    ? <Icon name="expand_more"  size="sm" className="text-gray-400" />
                    : <Icon name="chevron_right" size="sm" className="text-gray-300" />
                  }
                </div>
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {/* Tab bar */}
                  <div className="flex items-center gap-1 px-2 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto">
                    {EXPANDED_TABS.map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={e => { e.stopPropagation(); setExpandedTab(t => ({ ...t, [row.id]: tab.key })) }}
                        className={`text-[12px] px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                          activeTab === tab.key ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setExpandedId(null) }}
                      className="ml-auto shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 transition-colors"
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>

                  {/* Tab content */}
                  <div className="px-4 py-3 bg-white space-y-4">

                    {/* ── Overview ── */}
                    {activeTab === 'overview' && (() => {
                      const hasRagData   = ragStudent && (ragStudent.workingAtScore != null || ragStudent.prediction != null)
                      const hasSendData  = isSend && (row.supportSnapshot || hasAdjustments || (row.hasIlp && (ilpData === 'loading' || (ilpData && ilpData.targets.length > 0))))
                      const hasWondeData = row.attendancePercentage != null || row.behaviourPositive != null || row.hasExclusion === true
                      const hasAdaptiveData = adaptiveProfile && adaptiveProfile !== 'loading' &&
                        (adaptiveProfile.preferredTypes.length > 0 || adaptiveProfile.developmentAreas.length > 0 || Object.keys(adaptiveProfile.bloomsPerformance).length > 0)
                      if (!hasSendData && !hasRagData && !hasWondeData && !hasAdaptiveData) {
                        return <p className="text-[12px] text-gray-400 italic">No SEND data or predictions on record.</p>
                      }
                      return (
                        <>
                          {row.supportSnapshot && (
                            <p className="text-[12px] text-amber-800 italic leading-snug border-l-2 border-amber-300 pl-2.5">{row.supportSnapshot}</p>
                          )}
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
                                            <span key={i} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium leading-snug">{action}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {ehcpSectionF.length > 0 && (
                                      <div>
                                        <p className="text-[9px] font-semibold text-purple-600 uppercase tracking-wide mb-1.5">EHCP Section F</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {ehcpSectionF.map((provision, i) => (
                                            <span key={i} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium leading-snug">{provision}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </section>
                          )}
                          {isSend && row.hasIlp && (
                            <section>
                              <p className={SECTION_HEADING}>ILP Smart Goals</p>
                              {ilpData === 'loading' ? (
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400"><Icon name="refresh" size="sm" className="animate-spin" /> Loading…</div>
                              ) : !ilpData || ilpData.targets.length === 0 ? (
                                <p className="text-[12px] text-gray-400 italic">No active ILP targets.</p>
                              ) : (
                                <div className="space-y-2">
                                  {ilpData.targets.slice(0, 3).map((t, i) => (
                                    <div key={t.id} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
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
                          {hasRagData && ragStudent && (
                            <section>
                              <p className={SECTION_HEADING}>Progress vs Predicted</p>
                              <div className="grid grid-cols-2 gap-3">
                                {ragStudent.prediction && (
                                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Predicted</p>
                                    <p className="text-[14px] font-bold text-gray-900">
                                      {ragStudent.prediction.effectiveScore}%
                                      <span className="text-[11px] font-normal text-gray-500 ml-1">Grade {percentToGcseGrade(ragStudent.prediction.effectiveScore)}</span>
                                    </p>
                                  </div>
                                )}
                                {ragStudent.workingAtScore != null && (
                                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Working At</p>
                                    <p className="text-[14px] font-bold text-gray-900">
                                      {ragStudent.workingAtScore}%
                                      <span className="text-[11px] font-normal text-gray-500 ml-1">Grade {percentToGcseGrade(ragStudent.workingAtScore)}</span>
                                    </p>
                                  </div>
                                )}
                                {ragStudent.lastScore != null && (
                                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Last Score</p>
                                    <p className="text-[14px] font-bold text-gray-900">{ragStudent.lastScore}%</p>
                                  </div>
                                )}
                                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full shrink-0 ${RAG_DOT[ragStudent.ragStatus]}`} />
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Progress</p>
                                    <p className="text-[13px] font-semibold text-gray-700 capitalize">{ragStudent.ragStatus.replace('_', ' ')}</p>
                                  </div>
                                </div>
                              </div>
                            </section>
                          )}
                          {adaptiveProfile === 'loading' ? (
                            <section>
                              <p className={SECTION_HEADING}>Adaptive Profile</p>
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-400"><Icon name="refresh" size="sm" className="animate-spin" /> Loading…</div>
                            </section>
                          ) : adaptiveProfile && (adaptiveProfile.preferredTypes.length > 0 || adaptiveProfile.developmentAreas.length > 0 || Object.keys(adaptiveProfile.bloomsPerformance).length > 0) ? (
                            <section>
                              <p className={SECTION_HEADING}>Adaptive Profile</p>
                              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 space-y-2">
                                {adaptiveProfile.profileSummary && (
                                  <p className="text-[11px] text-indigo-800 italic leading-snug">{adaptiveProfile.profileSummary}</p>
                                )}
                                {adaptiveProfile.preferredTypes.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-semibold text-indigo-600 uppercase tracking-wide mb-1">Preferred Question Types</p>
                                    <div className="flex flex-wrap gap-1">
                                      {adaptiveProfile.preferredTypes.slice(0, 4).map(t => (
                                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">{t.replace(/_/g, ' ')}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {adaptiveProfile.developmentAreas.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Weak Topics</p>
                                    <div className="flex flex-wrap gap-1">
                                      {adaptiveProfile.developmentAreas.slice(0, 3).map(a => (
                                        <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">{a}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {Object.keys(adaptiveProfile.bloomsPerformance).length > 0 && (() => {
                                  const bloomsOrder = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']
                                  const entries = bloomsOrder.filter(k => adaptiveProfile.bloomsPerformance[k] != null)
                                  if (entries.length === 0) return null
                                  return (
                                    <div>
                                      <p className="text-[9px] font-semibold text-teal-600 uppercase tracking-wide mb-1">Bloom&apos;s Performance</p>
                                      <div className="flex flex-wrap gap-1">
                                        {entries.map(k => {
                                          const score = adaptiveProfile.bloomsPerformance[k]
                                          const col = score >= 70 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                          return (
                                            <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${col}`}>
                                              {k.charAt(0).toUpperCase() + k.slice(1)} {Math.round(score)}%
                                            </span>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            </section>
                          ) : null}
                          {hasWondeData && (
                            <section>
                              <p className={SECTION_HEADING}>MIS Data <span className="text-gray-300 font-normal normal-case tracking-normal ml-1">via Wonde</span></p>
                              <div className="flex flex-wrap gap-2">
                                {row.attendancePercentage != null && (() => {
                                  const pct = row.attendancePercentage
                                  const attCls = pct >= 95 ? 'bg-green-50 border-green-200 text-green-800' : pct >= 90 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'
                                  const attIcon = pct >= 95 ? 'check_circle' : pct >= 90 ? 'warning' : 'cancel'
                                  const attIconCls = pct >= 95 ? 'text-green-500' : pct >= 90 ? 'text-amber-500' : 'text-red-500'
                                  return (
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium ${attCls}`}>
                                      <Icon name={attIcon} size="sm" className={attIconCls} />
                                      {pct.toFixed(1)}% attendance this term
                                    </div>
                                  )
                                })()}
                                {row.behaviourPositive != null && (() => {
                                  const pos = row.behaviourPositive ?? 0
                                  const neg = row.behaviourNegative ?? 0
                                  const behCls = neg === 0 ? 'bg-green-50 border-green-200 text-green-800' : neg <= 1 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'
                                  return (
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium ${behCls}`}>
                                      <Icon name="emoji_events" size="sm" className="text-current opacity-70" />
                                      {pos} positive · {neg} {neg === 1 ? 'concern' : 'concerns'}
                                    </div>
                                  )
                                })()}
                                {row.hasExclusion === true && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 text-[12px] font-medium">
                                    <Icon name="report_problem" size="sm" className="text-amber-500" />
                                    Exclusion on record
                                  </div>
                                )}
                              </div>
                            </section>
                          )}
                        </>
                      )
                    })()}

                    {/* ── Plans ── */}
                    {activeTab === 'plans' && (() => {
                      const hasDocuments = row.hasIlp || row.hasEhcp || !!kPlan
                      return (
                        <>
                          {hasDocuments ? (
                            <section>
                              <p className={SECTION_HEADING}>Documents</p>
                              <div className="flex flex-wrap gap-2">
                                {row.hasIlp && (
                                  <button type="button" onClick={() => setDocSlideOver({ studentId: row.id, studentName, docType: 'ilp' })}
                                    className="flex items-center gap-2 px-3 py-2 border border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors text-left">
                                    <span className="material-icons text-blue-500" style={{ fontSize: '18px' }}>description</span>
                                    <div>
                                      <p className="text-[11px] font-semibold text-blue-700">ILP</p>
                                      <p className="text-[10px] text-gray-400">{ilpData && ilpData !== 'loading' ? ilpData.status.replace(/_/g, ' ') : '—'}</p>
                                    </div>
                                    <span className="text-[10px] text-blue-400 ml-1">Open →</span>
                                  </button>
                                )}
                                {row.hasEhcp && (
                                  <button type="button" onClick={() => setDocSlideOver({ studentId: row.id, studentName, docType: 'ehcp' })}
                                    className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-xl bg-white hover:bg-purple-50 transition-colors text-left">
                                    <span className="material-icons text-purple-500" style={{ fontSize: '18px' }}>verified_user</span>
                                    <div>
                                      <p className="text-[11px] font-semibold text-purple-700">EHCP</p>
                                      <p className="text-[10px] text-gray-400">{ehcpData && ehcpData !== 'loading' ? ehcpData.status.replace(/_/g, ' ') : '—'}</p>
                                    </div>
                                    <span className="text-[10px] text-purple-400 ml-1">Open →</span>
                                  </button>
                                )}
                                {kPlan && (
                                  <button type="button" onClick={() => setDocSlideOver({ studentId: row.id, studentName, docType: 'kplan' })}
                                    className="flex items-center gap-2 px-3 py-2 border border-green-200 rounded-xl bg-white hover:bg-green-50 transition-colors text-left">
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
                          ) : (
                            <p className="text-[12px] text-gray-400 italic">No SEND documents on record.</p>
                          )}

                          {isSend && kPlan && (() => {
                            const fullPassport = kPlanFullCache[row.id]
                            const checked      = kPlanChecked[row.id] ?? []
                            if (!fullPassport) loadKPlanFull(row.id)
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
                                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400"><Icon name="refresh" size="sm" className="animate-spin" /> Loading…</div>
                                    ) : fullPassport ? (
                                      <ul className="space-y-1.5">
                                        {fullPassport.teacherActions.map((action, i) => (
                                          <li key={i} className="flex items-start gap-2">
                                            <input type="checkbox" checked={checked[i] ?? false} onChange={() => toggleCheck(i)}
                                              className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-purple-600 cursor-pointer" />
                                            <span className={`text-[12px] leading-snug ${checked[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>{action}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-[12px] text-gray-400 italic">Could not load actions.</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button type="button" onClick={() => openKPlanModal(row.id, studentName)} disabled={kPlanLoading === row.id}
                                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50">
                                      {kPlanLoading === row.id ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="menu_book" size="sm" />}
                                      Full view
                                    </button>
                                  </div>
                                </div>
                              </section>
                            )
                          })()}

                          {isSend && (
                            <section>
                              <p className={SECTION_HEADING}>APDR</p>
                              <StudentAPDRPanel studentId={row.id} userRole={userRole} />
                            </section>
                          )}
                          {isSend && (
                            <a href={`/student/${row.id}/send`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                              View full SEND plan <Icon name="chevron_right" size="sm" />
                            </a>
                          )}
                        </>
                      )
                    })()}

                    {/* ── Homework ── */}
                    {activeTab === 'homework' && (() => {
                      if (!detail || detail === 'loading') {
                        return <div className="flex items-center gap-2 text-[12px] text-gray-400"><Icon name="refresh" size="sm" className="animate-spin" /> Loading…</div>
                      }
                      if (detail.recentSubmissions.length === 0) {
                        return <p className="text-[12px] text-gray-400 italic">No recent homework for this class.</p>
                      }
                      const last5  = detail.recentSubmissions.slice(0, 5)
                      const scored = last5.filter(s => (s.finalScore ?? s.autoScore) != null && s.maxScore)
                      let trendBadge: React.ReactNode = null
                      if (scored.length >= 2) {
                        const pct0 = Math.round(((scored[0].finalScore ?? scored[0].autoScore ?? 0) / scored[0].maxScore!) * 100)
                        const pct1 = Math.round(((scored[1].finalScore ?? scored[1].autoScore ?? 0) / scored[1].maxScore!) * 100)
                        if (pct0 > pct1) trendBadge = <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">▲ Improving</span>
                        else if (pct0 < pct1) trendBadge = <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">▼ Declining</span>
                      }
                      return (
                        <>
                          {trendBadge != null && <div className="flex items-center gap-2 mb-1">{trendBadge}</div>}
                          <div className="space-y-1.5">
                            {last5.map((s, i) => {
                              const score    = s.finalScore ?? s.autoScore
                              const pct      = score != null && s.maxScore ? Math.round((score / s.maxScore) * 100) : (score != null ? Math.round(score) : null)
                              const scoreStr = pct != null ? gradeLabel(percentToGcseGrade(pct)) : null
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <Link href={`/homework/${s.homeworkId}`} className="text-[12px] text-blue-600 hover:text-blue-800 hover:underline flex-1 truncate">{s.homeworkTitle}</Link>
                                  <span className="text-[10px] text-gray-400">{new Date(s.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
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
                        </>
                      )
                    })()}

                    {/* ── Assessments ── */}
                    {activeTab === 'assessments' && (() => {
                      if (!rosterDetail || rosterDetail === 'loading') {
                        return <div className="flex items-center gap-2 text-[12px] text-gray-400"><Icon name="refresh" size="sm" className="animate-spin" /> Loading…</div>
                      }
                      if (rosterDetail.examScores.length === 0) {
                        return <p className="text-[12px] text-gray-400 italic">No test or exam records found.</p>
                      }
                      return (
                        <div className="space-y-1.5">
                          {rosterDetail.examScores.slice(0, 5).map((s, i) => {
                            const pct = s.score != null && s.maxScore ? Math.round((s.score / s.maxScore) * 100) : null
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-[12px] text-gray-700 flex-1 truncate">{s.title}</span>
                                <span className="text-[10px] text-gray-400">{new Date(s.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                {s.score != null
                                  ? <span className={`text-[11px] font-bold shrink-0 ${pct != null && pct >= 70 ? 'text-green-600' : pct != null && pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{pct != null ? gradeLabel(percentToGcseGrade(pct)) : '—'}</span>
                                  : <span className="text-[11px] text-gray-400">Not marked</span>
                                }
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}

                    {/* ── Notes ── */}
                    {activeTab === 'notes' && (
                      <>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Icon name="sticky_note_2" size="sm" className="text-yellow-600" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-700">Class Notes</span>
                        </div>
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
                        ) : rosterDetail === 'loading' ? (
                          <div className="flex items-center gap-2 text-[12px] text-gray-400 mb-3"><Icon name="refresh" size="sm" className="animate-spin" /> Loading…</div>
                        ) : (
                          <p className="text-[12px] text-gray-400 italic mb-3">No class notes yet.</p>
                        )}
                        <div className="space-y-2">
                          <textarea
                            value={newNotes[row.id] ?? ''}
                            onChange={e => setNewNotes(n => ({ ...n, [row.id]: e.target.value }))}
                            placeholder="Add a class note about this student…"
                            rows={3}
                            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(row.id)}
                            disabled={savingNote === row.id || !newNotes[row.id]?.trim()}
                            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-white rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {savingNote === row.id ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="sticky_note_2" size="sm" />}
                            Add class note
                          </button>
                        </div>

                        {/* TA Notes */}
                        {(() => {
                          const taNotes = taNoteCache[row.id]
                          if (!taNotes || taNotes === 'loading') {
                            return (
                              <div className="flex items-center gap-2 text-[12px] text-gray-400 mt-4 pt-4 border-t border-gray-100">
                                <Icon name="refresh" size="sm" className="animate-spin" /> Loading TA notes…
                              </div>
                            )
                          }
                          if (taNotes.length === 0) return null
                          return (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Icon name="support_agent" size="sm" className="text-amber-600" />
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">TA Notes ({taNotes.length})</span>
                              </div>
                              {taNotes.map(n => (
                                <div key={n.id} className={`rounded-xl border px-3 py-2 ${n.isUrgent ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    {n.isUrgent && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">Urgent</span>}
                                    <span className="text-[10px] text-gray-400">{n.authorName} · {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                  </div>
                                  <p className="text-[12px] text-gray-700 leading-relaxed">{n.content}</p>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </>
                    )}

                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modals */}
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
      <StudentContactPanel studentId={contactStudentId} onClose={() => setContactStudentId(null)} zIndex={70} />
      {docSlideOver && (
        <DocSlideOver
          studentId={docSlideOver.studentId}
          studentName={docSlideOver.studentName}
          docType={docSlideOver.docType}
          onClose={() => setDocSlideOver(null)}
        />
      )}
      {flagConcernStudent && (
        <FlagConcernModal
          studentId={flagConcernStudent.id}
          studentName={flagConcernStudent.name}
          onClose={() => setFlagConcernStudent(null)}
        />
      )}
    </div>
  )
}

// ── FlagConcernModal ──────────────────────────────────────────────────────────

function FlagConcernModal({ studentId, studentName, onClose }: { studentId: string; studentName: string; onClose: () => void }) {
  const [description, setDescription] = useState('')
  const [urgency,     setUrgency]     = useState<'routine' | 'urgent'>('routine')
  const [submitting,  setSubmitting]  = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (description.trim().length < 10) { setError('Please provide at least 10 characters.'); return }
    setSubmitting(true); setError(null)
    try {
      await raiseConcern({ studentId, category: 'other', description: description.trim(), evidenceNotes: `urgency:${urgency}` })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to raise concern. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="flag" size="sm" className="text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">Flag SEND Concern</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
            <Icon name="close" size="sm" />
          </button>
        </div>
        {success ? (
          <div className="px-5 py-8 text-center space-y-2">
            <Icon name="check_circle" size="lg" className="text-green-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-900">Concern raised</p>
            <p className="text-xs text-gray-500">The SENCO has been notified about {studentName}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-500">Student: <span className="font-medium text-gray-900">{studentName}</span></p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description <span className="text-red-400">*</span></label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={4}
                placeholder="Describe the concern — what have you observed? Include specific examples if possible."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">{description.length}/1000 characters (min 10)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Urgency</label>
              <div className="flex gap-3">
                {(['routine', 'urgent'] as const).map(u => (
                  <label key={u} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-colors ${
                    urgency === u ? (u === 'urgent' ? 'border-red-400 bg-red-50' : 'border-blue-400 bg-blue-50') : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="urgency" value={u} checked={urgency === u} onChange={() => setUrgency(u)} className="sr-only" />
                    <span className={`text-sm font-medium capitalize ${urgency === u ? (u === 'urgent' ? 'text-red-700' : 'text-blue-700') : 'text-gray-600'}`}>
                      {u === 'routine' ? 'Routine' : 'Urgent'}
                    </span>
                  </label>
                ))}
              </div>
              {urgency === 'urgent' && <p className="text-xs text-red-600 mt-1.5">Urgent concerns are flagged prominently on the SENCO dashboard.</p>}
            </div>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                <Icon name="error" size="sm" className="shrink-0" />{error}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={submitting || description.trim().length < 10}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors">
                {submitting ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="flag" size="sm" />}
                Raise Concern
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
