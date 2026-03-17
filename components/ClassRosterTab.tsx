'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { getClassRoster, type ClassRosterRow } from '@/app/actions/lessons'
import StudentAvatar from '@/components/StudentAvatar'

const SEND_BADGE: Record<string, { label: string; cls: string }> = {
  SEN_SUPPORT: { label: 'SEN Support', cls: 'bg-amber-100 text-amber-700' },
  EHCP:        { label: 'EHCP',        cls: 'bg-purple-100 text-purple-700' },
}

export default function ClassRosterTab({ classId }: { classId: string }) {
  const [rows,    setRows]    = useState<ClassRosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getClassRoster(classId)
      .then(setRows)
      .catch(() => setError('Could not load class roster.'))
      .finally(() => setLoading(false))
  }, [classId])

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
          const badge = SEND_BADGE[row.sendStatus]
          const scoreDisplay = row.latestScore != null
            ? `${Math.round(row.latestScore)}%`
            : null

          return (
            <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors">
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
                  <span className="text-[11px] font-medium text-gray-500 w-9 text-right">
                    {scoreDisplay}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
