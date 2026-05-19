'use client'

import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import StudentAvatar from '@/components/StudentAvatar'
import SendBadge from '@/components/ui/SendBadge'
import { getClassRoster, type ClassRosterRow } from '@/app/actions/lessons'
import { getTaNotes, addTaNote, markTaNoteRead, getTaClasses, type TaNoteRow, type TaClass } from '@/app/actions/ta-notes'



export default function TaNotesHub() {
  const [classes,         setClasses]         = useState<TaClass[]>([])
  const [selectedClass,   setSelectedClass]   = useState<TaClass | null>(null)
  const [students,        setStudents]         = useState<ClassRosterRow[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  // Per-student TA notes cache
  const [notesCache,  setNotesCache]  = useState<Record<string, TaNoteRow[] | 'loading'>>({})
  // Per-student expanded state
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  // Per-student new note input
  const [noteText,    setNoteText]    = useState<Record<string, string>>({})
  const [noteUrgent,  setNoteUrgent]  = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)

  // Load classes on mount
  useEffect(() => {
    getTaClasses()
      .then(cls => {
        setClasses(cls)
        if (cls.length > 0) setSelectedClass(cls[0])
      })
      .catch(console.error)
  }, [])

  // Load students when class changes
  useEffect(() => {
    if (!selectedClass) return
    setStudents([])
    setExpandedId(null)
    setStudentsLoading(true)
    getClassRoster(selectedClass.id)
      .then(setStudents)
      .catch(console.error)
      .finally(() => setStudentsLoading(false))
  }, [selectedClass])

  function loadTaNotes(studentId: string) {
    if (notesCache[studentId]) return
    setNotesCache(c => ({ ...c, [studentId]: 'loading' }))
    getTaNotes(studentId)
      .then(notes => setNotesCache(c => ({ ...c, [studentId]: notes })))
      .catch(() => setNotesCache(c => ({ ...c, [studentId]: [] })))
  }

  function handleToggle(studentId: string) {
    if (expandedId === studentId) {
      setExpandedId(null)
    } else {
      setExpandedId(studentId)
      loadTaNotes(studentId)
    }
  }

  async function handleAddNote(studentId: string) {
    const content = noteText[studentId]?.trim()
    if (!content || saving === studentId) return
    const urgent = noteUrgent[studentId] ?? false
    setSaving(studentId)
    try {
      await addTaNote(studentId, content, urgent, selectedClass?.id)
      setNoteText(t => ({ ...t, [studentId]: '' }))
      setNoteUrgent(u => ({ ...u, [studentId]: false }))
      // Refresh notes for this student
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

      {/* Class picker */}
      {classes.length > 1 && (
        <div className="shrink-0 px-6 pt-4 pb-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClass(c)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  selectedClass?.id === c.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.name}
                <span className="ml-1.5 text-[10px] opacity-70">Yr {c.yearGroup}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-2">

        {studentsLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Icon name="refresh" size="md" className="animate-spin" />
            <span className="text-sm">Loading students…</span>
          </div>
        )}

        {!studentsLoading && students.length === 0 && (
          <EmptyState icon="groups" title="No students" description="No students enrolled in this class." size="md" />
        )}

        {!studentsLoading && students.map(student => {
          const isExpanded = expandedId === student.id
          const cachedNotes = notesCache[student.id]
          const notes = cachedNotes && cachedNotes !== 'loading' ? cachedNotes : []
          const urgentCount = notes.filter(n => n.isUrgent && !n.isRead).length

          return (
            <div key={student.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Student row */}
              <button
                type="button"
                onClick={() => handleToggle(student.id)}
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
                  <div className="flex items-center gap-2">
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

              {/* Expanded notes panel */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">

                  {/* Existing notes */}
                  {cachedNotes === 'loading' ? (
                    <div className="flex items-center gap-2 text-[12px] text-gray-400">
                      <Icon name="refresh" size="sm" className="animate-spin" /> Loading notes…
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No TA notes yet for this student.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.map(n => (
                        <div key={n.id} className={`rounded-xl border px-3 py-2.5 ${n.isUrgent ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
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

                  {/* Add new note */}
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
