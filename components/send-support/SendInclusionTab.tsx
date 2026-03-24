'use client'

import { useState, useEffect } from 'react'
import { Heart, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { getStudentIlp, getCurrentUserRole, type IlpWithTargets } from '@/app/actions/send-support'

const SendDocumentThumbnails = dynamic(() => import('@/components/send/SendDocumentThumbnails'), { ssr: false })

type SendStatusEntry = {
  id: string
  studentId: string
  activeStatus: string
  needArea: string | null
  student: {
    id: string
    firstName: string
    lastName: string
    supportSnapshot?: string | null
  }
}

type StrategyEntry = {
  strategyText: string
  appliesTo:    string
}

type PlanEntry = {
  strategies: StrategyEntry[]
  targets:    unknown[]
  reviewDate: Date | null
}

type Props = {
  sendStudents:  SendStatusEntry[]
  planByStudent: Record<string, PlanEntry>
  userRole?:     string   // optional — component self-fetches if not provided
  allEnrolled:   { user: { id: string; firstName: string; lastName: string } }[]
}

const TARGET_STATUS_CLS: Record<string, string> = {
  active:       'bg-blue-100 text-blue-700',
  achieved:     'bg-green-100 text-green-700',
  not_achieved: 'bg-red-100 text-red-700',
  deferred:     'bg-orange-100 text-orange-700',
}

export default function SendInclusionTab({ sendStudents, planByStudent, userRole: userRoleProp, allEnrolled }: Props) {
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({})
  const [expandedEhcp,  setExpandedEhcp]  = useState<Record<string, boolean>>({})
  const [ilpCache,      setIlpCache]      = useState<Record<string, IlpWithTargets | 'loading' | null>>({})
  const [userRole,      setUserRole]      = useState(userRoleProp ?? 'TEACHER')

  useEffect(() => {
    if (!userRoleProp) {
      getCurrentUserRole().then(r => { if (r) setUserRole(r) }).catch(() => {})
    }
  }, [userRoleProp])

  const sendIds      = new Set(sendStudents.map(s => s.studentId))
  const noSendPupils = allEnrolled.filter(e => !sendIds.has(e.user.id))

  function toggleGoals(studentId: string) {
    const next = !expandedGoals[studentId]
    setExpandedGoals(g => ({ ...g, [studentId]: next }))
    if (next && !ilpCache[studentId]) {
      setIlpCache(c => ({ ...c, [studentId]: 'loading' }))
      getStudentIlp(studentId)
        .then(ilp => setIlpCache(c => ({ ...c, [studentId]: ilp })))
        .catch(() => setIlpCache(c => ({ ...c, [studentId]: null })))
    }
  }

  if (sendStudents.length === 0 && allEnrolled.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-2xl p-12 text-center">
        <Heart size={28} className="mx-auto text-gray-300 mb-3" />
        <p className="text-[13px] font-medium text-gray-500 mb-1">No class assigned</p>
        <p className="text-[12px] text-gray-400">Assign this lesson to a class to see SEND profiles.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-3">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
          sendStudents.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {sendStudents.length} pupil{sendStudents.length !== 1 ? 's' : ''} with SEND needs
        </span>
        <span className="text-[11px] text-gray-400">
          {allEnrolled.length} enrolled total
        </span>
      </div>

      {/* SEND pupil cards */}
      {sendStudents.map(ss => {
        const plan = planByStudent[ss.studentId] as PlanEntry | undefined
        const classStrategies = plan?.strategies.filter(s => s.appliesTo === 'CLASSROOM' || s.appliesTo === 'BOTH') ?? []
        const hwStrategies    = plan?.strategies.filter(s => s.appliesTo === 'HOMEWORK'  || s.appliesTo === 'BOTH') ?? []
        const studentName     = `${ss.student.firstName} ${ss.student.lastName}`
        const isEhcp          = ss.activeStatus === 'EHCP'
        const ilpData         = ilpCache[ss.studentId]

        return (
          <div key={ss.id} className="border border-gray-200 rounded-2xl overflow-hidden">

            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-rose-50/60 border-b border-rose-100">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                {ss.student.firstName[0]}{ss.student.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">{studentName}</p>
                {ss.needArea && (
                  <p className="text-[11px] text-rose-600 font-medium mt-0.5">{ss.needArea}</p>
                )}
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                isEhcp ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {isEhcp ? 'EHCP' : 'SEN Support'}
              </span>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Support snapshot */}
              {ss.student.supportSnapshot && (
                <div className="border-l-4 border-amber-300 pl-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-1">Support Snapshot</p>
                  <p className="text-[12px] text-amber-900 italic leading-snug">{ss.student.supportSnapshot}</p>
                </div>
              )}

              {/* Document thumbnails */}
              <SendDocumentThumbnails
                studentId={ss.studentId}
                studentName={studentName}
                userRole={userRole}
              />

              {/* Collapsible SMART goals */}
              <div>
                <button
                  onClick={() => toggleGoals(ss.studentId)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {expandedGoals[ss.studentId] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  SMART Goals
                </button>
                {expandedGoals[ss.studentId] && (
                  <div className="mt-2 pl-2">
                    {ilpData === 'loading' ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Loader2 size={11} className="animate-spin" /> Loading…
                      </div>
                    ) : !ilpData || ilpData.targets.length === 0 ? (
                      <p className="text-[12px] text-gray-400 italic">No ILP targets on record.</p>
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
                  </div>
                )}
              </div>

              {/* Collapsible EHCP provisions */}
              {isEhcp && (
                <div>
                  <button
                    onClick={() => setExpandedEhcp(e => ({ ...e, [ss.studentId]: !e[ss.studentId] }))}
                    className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    {expandedEhcp[ss.studentId] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    EHCP Provisions
                  </button>
                  {expandedEhcp[ss.studentId] && (
                    <div className="mt-2 pl-2">
                      <p className="text-[12px] text-gray-400 italic">
                        Open the EHCP document thumbnail above to view Section F provisions.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* In-lesson strategies */}
              {classStrategies.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">In-lesson Strategies</p>
                  <ul className="space-y-1.5">
                    {classStrategies.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        {s.strategyText}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Homework strategies */}
              {hwStrategies.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Homework Strategies</p>
                  <ul className="space-y-1.5">
                    {hwStrategies.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {s.strategyText}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!plan && !ss.student.supportSnapshot && (
                <p className="text-[12px] text-gray-400 italic">No active ILP on record. Contact the SENCo to create one.</p>
              )}
            </div>
          </div>
        )
      })}

      {/* Non-SEND pupils pill row */}
      {noSendPupils.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            No SEND needs on record ({noSendPupils.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {noSendPupils.map(e => (
              <div key={e.user.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-3 py-1">
                <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {e.user.firstName[0]}{e.user.lastName[0]}
                </div>
                <span className="text-[11px] text-gray-600">{e.user.firstName} {e.user.lastName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
