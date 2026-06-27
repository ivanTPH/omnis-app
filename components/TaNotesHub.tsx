'use client'

import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import StudentAvatar from '@/components/StudentAvatar'
import SendBadge from '@/components/ui/SendBadge'
import { getClassRoster, type ClassRosterRow } from '@/app/actions/lessons'
import { getTaNotes, addTaNote, markTaNoteRead, getTaClasses, getTaSendProfile, type TaNoteRow, type TaClass, type TaSendProfile } from '@/app/actions/ta-notes'

export default function TaNotesHub() {
  const [classes,         setClasses]         = useState<TaClass[]>([])
  const [selectedYear,    setSelectedYear]    = useState<number | null>(null)
  const [selectedClass,   setSelectedClass]   = useState<TaClass | null>(null)
  const [students,        setStudents]        = useState<ClassRosterRow[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  const [notesCache,     setNotesCache]     = useState<Record<string, TaNoteRow[] | 'loading'>>({})
  const [sendProfiles,   setSendProfiles]   = useState<Record<string, TaSendProfile | null>>({})
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [noteText,    setNoteText]    = useState<Record<string, string>>({})
  const [noteUrgent,  setNoteUrgent]  = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    getTaClasses().then(setClasses).catch(() => {})
  }, [])

  const yearGroups = [...new Set(classes.map(c => c.yearGroup))].sort((a, b) => a - b)
  const classesForYear = selectedYear ? classes.filter(c => c.yearGroup === selectedYear) : []

  function handleYearChange(year: number | null) {
    setSelectedYear(year)
    setSelectedClass(null)
    setStudents([])
    setExpandedId(null)
  }

  function handleClassChange(classId: string) {
    const cls = classesForYear.find(c => c.id === classId)
    if (!cls) return
    setSelectedClass(cls)
    setStudents([])
    setExpandedId(null)
    setStudentsLoading(true)
    getClassRoster(cls.id)
      .then(setStudents)
      .catch(() => {})
      .finally(() => setStudentsLoading(false))
  }

  function loadTaNotes(studentId: string) {
    if (notesCache[studentId]) return
    setNotesCache(c => ({ ...c, [studentId]: 'loading' }))
    getTaNotes(studentId)
      .then(notes => setNotesCache(c => ({ ...c, [studentId]: notes })))
      .catch(() => setNotesCache(c => ({ ...c, [studentId]: [] })))
  }

  function handleToggle(studentId: string, sendStatus: string) {
    if (expandedId === studentId) { setExpandedId(null); return }
    setExpandedId(studentId)
    loadTaNotes(studentId)
    // Lazy-load SEND profile for SEND students
    if (sendStatus !== 'NONE' && !(studentId in sendProfiles)) {
      getTaSendProfile(studentId)
        .then(profile => setSendProfiles(p => ({ ...p, [studentId]: profile })))
        .catch(() => setSendProfiles(p => ({ ...p, [studentId]: null })))
    }
  }

  async function handleAddNote(studentId: string) {
    const content = noteText[studentId]?.trim()
    if (!content || saving === studentId) return
    setSaving(studentId)
    try {
      await addTaNote(studentId, content, noteUrgent[studentId] ?? false, selectedClass?.id)
      setNoteText(t => ({ ...t, [studentId]: '' }))
      setNoteUrgent(u => ({ ...u, [studentId]: false }))
      setNotesCache(c => ({ ...c, [studentId]: 'loading' }))
      const updated = await getTaNotes(studentId)
      setNotesCache(c => ({ ...c, [studentId]: updated }))
    } finally {
      setSaving(null)
    }
  }

  async function handleMarkRead(studentId: string, noteId: string) {
    startTransition(async () => {
      await markTaNoteRead(noteId)
      setNotesCache(c => {
        const existing = c[studentId]
        if (!existing || existing === 'loading') return c
        return { ...c, [studentId]: existing.map(n => n.id === noteId ? { ...n, isRead: true } : n) }
      })
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Filters ── */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-end gap-4">

          <div className="w-44">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Year Group
            </label>
            <select
              value={selectedYear ?? ''}
              onChange={e => handleYearChange(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-[13px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
            >
              <option value="">Select year…</option>
              {yearGroups.map(yr => (
                <option key={yr} value={yr}>Year {yr}</option>
              ))}
            </select>
          </div>

          <div className="w-56">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Class
            </label>
            <select
              value={selectedClass?.id ?? ''}
              onChange={e => handleClassChange(e.target.value)}
              disabled={!selectedYear || classesForYear.length === 0}
              className="w-full text-[13px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">Select class…</option>
              {classesForYear.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name} — {cls.subject}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* ── Student list ── */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-2">

        {!selectedYear && (
          <EmptyState icon="school" title="Select a year group" description="Choose a year group to see classes." size="md" />
        )}
        {selectedYear && !selectedClass && (
          <EmptyState icon="groups" title="Select a class" description="Choose a class to see its students." size="md" />
        )}

        {selectedClass && studentsLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Icon name="refresh" size="md" className="animate-spin" />
            <span className="text-sm">Loading students…</span>
          </div>
        )}

        {selectedClass && !studentsLoading && students.length === 0 && (
          <EmptyState icon="person_off" title="No students" description="No students enrolled in this class." size="md" />
        )}

        {selectedClass && !studentsLoading && students.map(student => {
          const isExpanded = expandedId === student.id
          const cachedNotes = notesCache[student.id]
          const notes = cachedNotes && cachedNotes !== 'loading' ? cachedNotes : []
          const urgentCount = notes.filter(n => n.isUrgent && !n.isRead).length

          return (
            <div key={student.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => handleToggle(student.id, student.sendStatus)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <StudentAvatar
                  firstName={student.firstName}
                  lastName={student.lastName}
                  avatarUrl={student.avatarUrl}
                  size="sm"
                  sendStatus={student.sendStatus as 'NONE' | 'SEN_SUPPORT' | 'EHCP'}
                  userId={student.id}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-gray-900">
                      {student.firstName} {student.lastName}
                    </span>
                    {student.sendStatus !== 'NONE' && (
                      <SendBadge status={student.sendStatus as 'SEN_SUPPORT' | 'EHCP'} size="sm" />
                    )}
                    {urgentCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                        {urgentCount} urgent
                      </span>
                    )}
                    {notes.length > 0 && urgentCount === 0 && (
                      <span className="text-[10px] text-gray-400">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <Icon
                  name="expand_more"
                  size="sm"
                  className={`text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">

                  {/* SEND strategies panel */}
                  {student.sendStatus !== 'NONE' && (() => {
                    const profile = sendProfiles[student.id]
                    if (profile === undefined) return (
                      <div className="flex items-center gap-2 text-[11px] text-purple-500 bg-purple-50 rounded-lg px-3 py-2">
                        <Icon name="refresh" size="sm" className="animate-spin" /> Loading SEND profile…
                      </div>
                    )
                    if (!profile) return null
                    return (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon name="support" size="sm" className="text-purple-600" />
                          <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">
                            {profile.sendStatus === 'EHCP' ? 'EHCP' : 'SEN Support'} — Classroom Strategies
                          </span>
                        </div>
                        {profile.needArea && (
                          <p className="text-[11px] text-purple-700 font-medium">{profile.needArea}</p>
                        )}
                        {profile.supportSnapshot && (
                          <p className="text-[12px] text-purple-800 leading-relaxed">{profile.supportSnapshot}</p>
                        )}
                        {profile.classroomStrategies.length > 0 && (
                          <ul className="space-y-1 mt-1">
                            {profile.classroomStrategies.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-[12px] text-purple-800">
                                <Icon name="check_circle" size="sm" className="text-purple-400 shrink-0 mt-0.5" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        )}
                        {profile.ilpTargets.length > 0 && (
                          <div className="pt-1 border-t border-purple-100">
                            <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide mb-1">ILP targets</p>
                            {profile.ilpTargets.map(t => (
                              <p key={t.id} className="text-[11px] text-purple-700 leading-snug">• {t.target}</p>
                            ))}
                          </div>
                        )}
                        {profile.classroomStrategies.length === 0 && !profile.supportSnapshot && profile.ilpTargets.length === 0 && (
                          <p className="text-[11px] text-purple-500 italic">No strategies recorded yet — SENCO can add these in the student&apos;s SEND profile.</p>
                        )}
                      </div>
                    )
                  })()}

                  {cachedNotes === 'loading' ? (
                    <div className="flex items-center gap-2 text-[12px] text-gray-400">
                      <Icon name="refresh" size="sm" className="animate-spin" /> Loading notes…
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No TA notes yet for this student.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.map(n => (
                        <div
                          key={n.id}
                          className={`rounded-xl border px-3 py-2.5 ${n.isUrgent ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                {n.isUrgent && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">Urgent</span>
                                )}
                                {!n.isRead && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Unread</span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-[13px] text-gray-800 leading-relaxed">{n.content}</p>
                            </div>
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(student.id, n.id)}
                                title="Mark as read"
                                className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                              >
                                <Icon name="mark_email_read" size="sm" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 pt-1">
                    <textarea
                      value={noteText[student.id] ?? ''}
                      onChange={e => setNoteText(t => ({ ...t, [student.id]: e.target.value }))}
                      placeholder={`Add a note about ${student.firstName}…`}
                      rows={3}
                      className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noteUrgent[student.id] ?? false}
                          onChange={e => setNoteUrgent(u => ({ ...u, [student.id]: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded accent-red-600"
                        />
                        <Icon name="priority_high" size="sm" className="text-red-500" />
                        Mark as urgent
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAddNote(student.id)}
                        disabled={saving === student.id || !noteText[student.id]?.trim()}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {saving === student.id
                          ? <Icon name="refresh" size="sm" className="animate-spin" />
                          : <Icon name="add_comment" size="sm" />
                        }
                        Add note
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
