'use client'
import { useState, useEffect } from 'react'
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
  getClassEhcpSectionF,
  getStudentIlp,
  generateILPForStudent,
  type LearnerPassportRow,
  type IlpWithTargets,
} from '@/app/actions/send-support'
import { getStudentEhcp, type EhcpPlanWithOutcomes } from '@/app/actions/ehcp'
import { getClassRagData, type RagStudent } from '@/app/actions/rag'
import { getTaNotes, type TaNoteRow } from '@/app/actions/ta-notes'
import type { DocSlideOverDocType } from '@/components/send/DocSlideOver'

export type KPlanSummary = { id: string; sendInformation: string; status: string; teacherActions: string[] }
export type ExpandedTabKey = 'overview' | 'plans' | 'homework' | 'assessments' | 'notes'

export function useClassRosterData(
  classId: string,
  onSelectionChange?: (ids: string[]) => void,
) {
  const [rows,             setRows]             = useState<ClassRosterRow[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [expandedId,       setExpandedId]       = useState<string | null>(null)
  const [contactStudentId, setContactStudentId] = useState<string | null>(null)

  const [detailsCache,      setDetailsCache]      = useState<Record<string, StudentClassDetail | 'loading'>>({})
  const [ilpCache,          setIlpCache]          = useState<Record<string, IlpWithTargets | 'loading' | null>>({})
  const [ehcpCache,         setEhcpCache]         = useState<Record<string, EhcpPlanWithOutcomes | 'loading' | null>>({})
  const [rosterDetailCache, setRosterDetailCache] = useState<Record<string, StudentRosterDetail | 'loading'>>({})
  const [taNoteCache,       setTaNoteCache]       = useState<Record<string, TaNoteRow[] | 'loading'>>({})

  const [userRole,       setUserRole]       = useState<string>('TEACHER')
  const [kPlanMap,       setKPlanMap]       = useState<Record<string, KPlanSummary>>({})
  const [generatingIlp,  setGeneratingIlp]  = useState<Record<string, boolean>>({})
  const [ilpError,       setIlpError]       = useState<string | null>(null)
  const [kPlanModal,     setKPlanModal]     = useState<{ studentId: string; studentName: string; passport: LearnerPassportRow } | null>(null)
  const [kPlanLoading,   setKPlanLoading]   = useState<string | null>(null)
  const [kPlanFullCache, setKPlanFullCache] = useState<Record<string, LearnerPassportRow | 'loading'>>({})
  const [kPlanChecked,   setKPlanChecked]   = useState<Record<string, boolean[]>>({})

  const [ragMap,      setRagMap]      = useState<Record<string, RagStudent>>({})
  const [ehcpTipsMap, setEhcpTipsMap] = useState<Record<string, string[]>>({})

  const [docSlideOver,       setDocSlideOver]       = useState<{ studentId: string; studentName: string; docType: DocSlideOverDocType } | null>(null)
  const [newNotes,           setNewNotes]           = useState<Record<string, string>>({})
  const [savingNote,         setSavingNote]         = useState<string | null>(null)
  const [flagConcernStudent, setFlagConcernStudent] = useState<{ id: string; name: string } | null>(null)
  const [expandedTab,        setExpandedTab]        = useState<Record<string, ExpandedTabKey>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [sendFilter,  setSendFilter]  = useState<'ALL' | 'SEN_SUPPORT' | 'EHCP' | 'NO_PLAN' | 'NO_PASSPORT'>('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getClassRoster(classId).catch(e => { console.error('[useClassRosterData] getClassRoster:', e); return [] as ClassRosterRow[] }),
      getCurrentUserRole().catch(e => { console.error('[useClassRosterData] getCurrentUserRole:', e); return null }),
      getClassKPlanSummaries(classId).catch(e => { console.error('[useClassRosterData] getClassKPlanSummaries:', e); return {} as Record<string, KPlanSummary> }),
      getClassRagData(classId).catch(e => { console.error('[useClassRosterData] getClassRagData:', e); return [] as RagStudent[] }),
      getClassEhcpSectionF(classId).catch(e => { console.error('[useClassRosterData] getClassEhcpSectionF:', e); return {} as Record<string, string[]> }),
    ])
      .then(([r, role, kplans, rag, ehcpTips]) => {
        if (cancelled) return
        setRows(r)
        setUserRole(role ?? 'TEACHER')
        setKPlanMap(kplans)
        const rm: Record<string, RagStudent> = {}
        for (const s of rag) rm[s.id] = s
        setRagMap(rm)
        setEhcpTipsMap(ehcpTips)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId])

  useEffect(() => { setSelectedIds([]) }, [sendFilter])
  useEffect(() => { onSelectionChange?.(selectedIds) }, [selectedIds, onSelectionChange])

  // ── Expand / collapse ────────────────────────────────────────────────────

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
    if (!taNoteCache[id]) {
      setTaNoteCache(c => ({ ...c, [id]: 'loading' }))
      getTaNotes(id)
        .then(notes => setTaNoteCache(c => ({ ...c, [id]: notes })))
        .catch(() => setTaNoteCache(c => ({ ...c, [id]: [] })))
    }
  }

  function handleToggle(row: ClassRosterRow) {
    const id = row.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setExpandedTab(t => ({ ...t, [id]: t[id] ?? 'overview' }))
    loadExpandData(row)
  }

  function handleDocBadge(e: React.MouseEvent, row: ClassRosterRow, docType: DocSlideOverDocType) {
    e.stopPropagation()
    setDocSlideOver({ studentId: row.id, studentName: `${row.firstName} ${row.lastName}`, docType })
    if (expandedId !== row.id) {
      setExpandedId(row.id)
      setExpandedTab(t => ({ ...t, [row.id]: t[row.id] ?? 'overview' }))
      loadExpandData(row)
    }
  }

  // ── K Plan ───────────────────────────────────────────────────────────────

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
            setKPlanFullCache(c => ({ ...c, [studentId]: p ?? ('loading' as never) }))
            if (p) setKPlanChecked(ch => ({ ...ch, [studentId]: new Array(p.teacherActions.length).fill(false) }))
          })
          .catch(() => setKPlanFullCache(c => ({ ...c, [studentId]: 'loading' })))
      })
    }
  }

  // ── Notes ────────────────────────────────────────────────────────────────

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

  // ── ILP generation ───────────────────────────────────────────────────────

  async function handleGenerateIlp(studentId: string) {
    setIlpError(null)
    setGeneratingIlp(g => ({ ...g, [studentId]: true }))
    try {
      const result = await generateILPForStudent(studentId)
      if (!result.success) {
        setIlpError(result.error ?? 'ILP generation failed — please try again.')
      } else {
        const updated = await getClassRoster(classId)
        setRows(updated)
      }
    } catch {
      setIlpError('ILP generation failed — please try again.')
    } finally {
      setGeneratingIlp(g => ({ ...g, [studentId]: false }))
    }
  }

  return {
    // Data
    rows, loading, error, userRole,
    kPlanMap, ragMap, ehcpTipsMap,
    detailsCache, ilpCache, ehcpCache, rosterDetailCache, taNoteCache,
    kPlanFullCache, kPlanChecked, kPlanLoading, kPlanModal, generatingIlp, ilpError,
    newNotes, savingNote, docSlideOver, flagConcernStudent,
    expandedId, expandedTab, selectedIds, searchQuery, sendFilter, contactStudentId,
    // Setters
    setRows, setExpandedId, setExpandedTab, setSelectedIds,
    setSearchQuery, setSendFilter, setContactStudentId,
    setDocSlideOver, setFlagConcernStudent, setKPlanModal, setKPlanChecked,
    setNewNotes, setIlpError,
    // Actions
    handleToggle, handleDocBadge, handleSaveNote, handleGenerateIlp,
    openKPlanModal, refreshKPlanMap, loadKPlanFull,
  }
}
