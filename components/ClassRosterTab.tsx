'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { getClassRoster, getStudentClassDetail, type ClassRosterRow, type StudentClassDetail } from '@/app/actions/lessons'
import StudentAvatar from '@/components/StudentAvatar'

const SEND_BADGE: Record<string, { label: string; cls: string }> = {
  SEN_SUPPORT: { label: 'SEN Support', cls: 'bg-amber-100 text-amber-700' },
  EHCP:        { label: 'EHCP',        cls: 'bg-purple-100 text-purple-700' },
}

const STATUS_COLORS: Record<string, string> = {
  RETURNED:           'bg-green-100 text-green-700',
  MARKED:             'bg-blue-100 text-blue-700',
  UNDER_REVIEW:       'bg-amber-100 text-amber-700',
  RESUBMISSION_REQ:   'bg-orange-100 text-orange-700',
  SUBMITTED:          'bg-gray-100 text-gray-600',
}

export default function ClassRosterTab({ classId }: { classId: string }) {
  const [rows,         setRows]         = useState<ClassRosterRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [detailsCache, setDetailsCache] = useState<Record<string, StudentClassDetail | 'loading'>>({})

  useEffect(() => {
    setLoading(true)
    setError(null)
    getClassRoster(classId)
      .then(setRows)
      .catch(() => setError('Could not load class roster.'))
      .finally(() => setLoading(false))
  }, [classId])

  function handleToggle(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!detailsCache[id]) {
      setDetailsCache(c => ({ ...c, [id]: 'loading' }))
      getStudentClassDetail(id, classId)
        .then(d  => setDetailsCache(c => ({ ...c, [id]: d })))
        .catch(() => setDetailsCache(c => ({ ...c, [id]: { recentSubmissions: [] } })))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 py-8 justify-center text-[13px]">
        <AlertCircle size={15} /> {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-gray-400 text-center py-10">No students enrolled in this class.</p>
    )
  }

  const sendCount  = rows.filter(r => r.sendStatus !== 'NONE').length
  const ilpCount   = rows.filter(r => r.hasIlp).length
  const ehcpCount  = rows.filter(r => r.sendStatus === 'EHCP').length

  return (
    <div className="space-y-5">

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-[11px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
          {rows.length} students
        </span>
        {sendCount > 0 && (
          <span className="text-[11px] px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
            {sendCount} SEND
          </span>
        )}
        {ehcpCount > 0 && (
          <span className="text-[11px] px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
            {ehcpCount} EHCP
          </span>
        )}
        {ilpCount > 0 && (
          <span className="text-[11px] px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
            {ilpCount} active ILP
          </span>
        )}
      </div>

      {/* Student rows */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {rows.map(row => {
          const badge        = SEND_BADGE[row.sendStatus]
          const scoreDisplay = row.latestScore != null
            ? (row.maxScore ? `${Math.round(row.latestScore)}/${row.maxScore}` : `${Math.round(row.latestScore)}`)
            : null
          const isExpanded   = expandedId === row.id
          const detail       = detailsCache[row.id]

          return (
            <div key={row.id}>
              {/* Row */}
              <button
                onClick={() => handleToggle(row.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors text-left"
              >
                <StudentAvatar
                  firstName={row.firstName}
                  lastName={row.lastName}
                  avatarUrl={row.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 truncate">
                    {row.firstName} {row.lastName}
                  </p>
                  {row.needArea && (
                    <p className="text-[10px] text-gray-400 truncate">{row.needArea}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
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
                  {scoreDisplay && (
                    <span className="text-[11px] font-medium text-gray-500 w-12 text-right">
                      {scoreDisplay}
                    </span>
                  )}
                  {isExpanded
                    ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
                    : <ChevronRight size={13} className="text-gray-300 shrink-0" />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-3">

                  {/* SEND / ILP info */}
                  <div className="flex flex-wrap gap-2">
                    {badge ? (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No SEND needs</span>
                    )}
                    {row.hasIlp && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Active ILP</span>
                    )}
                    {row.needArea && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{row.needArea}</span>
                    )}
                  </div>

                  {/* Recent homework */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent Homework</p>
                    {detail === 'loading' ? (
                      <div className="flex items-center gap-2 text-[12px] text-gray-400">
                        <Loader2 size={12} className="animate-spin" /> Loading…
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

                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
