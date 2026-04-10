'use client'
import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'
import {
  getClassBriefing, bulkGenerateLearningPassports,
  type ClassBriefingStudent,
} from '@/app/actions/students'

export default function ClassBriefingCard({ classId }: { classId: string }) {
  const [students,    setStudents]    = useState<ClassBriefingStudent[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState(false)
  const [generating,  startGenerate]  = useTransition()
  const [genResult,   setGenResult]   = useState<{ generated: number; errors: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    getClassBriefing(classId)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false))
  }, [classId])

  function handleGenerate() {
    startGenerate(async () => {
      const result = await bulkGenerateLearningPassports(classId)
      setGenResult(result)
      // Reload briefing after generation
      const updated = await getClassBriefing(classId)
      setStudents(updated)
    })
  }

  if (loading) return null   // silent load — don't flash spinner above objectives

  const sendBadge: Record<string, string> = {
    EHCP:        'bg-purple-100 text-purple-700',
    SEN_SUPPORT: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="border border-blue-100 bg-blue-50 rounded-xl overflow-hidden mb-4">

      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon
            name={expanded ? 'expand_less' : 'expand_more'}
            size="sm"
            className="text-blue-500"
          />
          <span className="text-[12px] font-semibold text-blue-800">
            Class briefing
          </span>
          {students.length > 0 && (
            <span className="text-[11px] text-blue-500">
              — {students.length} student{students.length !== 1 ? 's' : ''} need preparation
            </span>
          )}
          {students.length === 0 && !loading && (
            <span className="text-[11px] text-blue-400">— no preparation notes yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleGenerate() }}
            disabled={generating}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 px-2 py-1 rounded hover:bg-blue-100 transition"
            title="Auto-generate Learning Passports for all students in this class"
          >
            <Icon
              name={generating ? 'refresh' : 'auto_awesome'}
              size="sm"
              className={generating ? 'animate-spin' : ''}
            />
            {generating ? 'Generating…' : 'Generate passports'}
          </button>
        </div>
      </button>

      {/* Result banner */}
      {genResult && (
        <div className="px-4 pb-2 text-[11px] text-blue-700">
          Generated {genResult.generated} passports
          {genResult.errors > 0 ? `, ${genResult.errors} failed` : ''}. Expand to see strategies.
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-blue-100 px-4 py-3 space-y-3">
          {students.length === 0 ? (
            <p className="text-[12px] text-blue-500 text-center py-2">
              No classroom strategies recorded yet. Click &ldquo;Generate passports&rdquo; to create them from homework performance data.
            </p>
          ) : (
            students.map(s => (
              <div key={s.id} className="flex items-start gap-3">
                <StudentAvatar
                  firstName={s.firstName}
                  lastName={s.lastName}
                  avatarUrl={s.avatarUrl}
                  size="xs"
                  sendStatus={s.sendCategory as 'EHCP' | 'SEN_SUPPORT' | null}
                  userId={s.id}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-gray-900">
                      {s.firstName} {s.lastName}
                    </span>
                    {s.sendCategory && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${sendBadge[s.sendCategory] ?? 'bg-gray-100 text-gray-500'}`}>
                        {s.sendCategory === 'EHCP' ? 'EHCP' : 'SEN'}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {s.classroomStrategies.slice(0, 3).map((strat, i) => (
                      <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1">
                        <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                        {strat}
                      </li>
                    ))}
                    {s.classroomStrategies.length > 3 && (
                      <li className="text-[11px] text-blue-500">
                        +{s.classroomStrategies.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
