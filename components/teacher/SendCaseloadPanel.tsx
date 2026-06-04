'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { gradeLabel, gradePillClass } from '@/lib/grading'
import type { TeacherSendCaseload, CaseloadStudent } from '@/app/actions/teacher-send'

type Props = { data: TeacherSendCaseload }

function SendBadge({ status }: { status: 'SEN_SUPPORT' | 'EHCP' }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
      status === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {status === 'EHCP' ? 'EHCP' : 'SEN Support'}
    </span>
  )
}

function GradePill({ grade }: { grade: number }) {
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${gradePillClass(grade)}`}>
      {gradeLabel(grade)}
    </span>
  )
}

function StudentCard({ student, defaultOpen }: { student: CaseloadStudent; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  const reviewUrgent = student.reviewDaysUntil != null && student.reviewDaysUntil <= 7
  const reviewSoon   = student.reviewDaysUntil != null && student.reviewDaysUntil <= 14

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${
      !student.hasIlp ? 'border-amber-200' :
      reviewUrgent    ? 'border-red-200'   :
                        'border-gray-200'
    }`}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
          student.sendStatus === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {student.firstName[0]}{student.lastName[0]}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {student.firstName} {student.lastName}
            </span>
            {student.yearGroup && (
              <span className="text-[10px] text-gray-400">Yr {student.yearGroup}</span>
            )}
            <SendBadge status={student.sendStatus} />
            {!student.hasIlp && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                No ILP
              </span>
            )}
            {reviewUrgent && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                Review {student.reviewDaysUntil === 0 ? 'today' : `in ${student.reviewDaysUntil}d`}
              </span>
            )}
            {reviewSoon && !reviewUrgent && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                Review in {student.reviewDaysUntil}d
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {student.needArea && (
              <span className="text-[11px] text-gray-500">{student.needArea}</span>
            )}
            {student.classNames.length > 0 && (
              <span className="text-[10px] text-gray-400">· {student.classNames.join(', ')}</span>
            )}
          </div>
        </div>

        {/* Right: grade + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {student.avgGrade != null ? (
            <div className="text-right">
              <GradePill grade={student.avgGrade} />
              <p className="text-[9px] text-gray-400 mt-0.5 text-center">avg (90d)</p>
            </div>
          ) : (
            <span className="text-[11px] text-gray-300">No grades</span>
          )}
          <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400" />
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">

          {/* ILP targets */}
          {student.hasIlp && student.activeTargets.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Active ILP targets ({student.activeTargets.length})
              </p>
              <ul className="space-y-2">
                {student.activeTargets.map(t => (
                  <li key={t.id} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Icon name="task_alt" size="sm" className="text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-800">{t.target}</p>
                      <p className={`text-[10px] mt-0.5 font-medium ${
                        t.daysLeft <= 14 ? 'text-red-600' : t.daysLeft <= 30 ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        Due {new Date(t.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {t.daysLeft <= 14 && ` · ${t.daysLeft}d`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : student.hasIlp ? (
            <p className="text-[12px] text-gray-400 italic">No active ILP targets.</p>
          ) : (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <Icon name="warning" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-800">
                This student has no approved ILP. Contact the SENCO to create one, or{' '}
                <Link href="/senco/concerns" className="underline font-medium">raise a concern</Link>.
              </p>
            </div>
          )}

          {/* ILP review date */}
          {student.reviewDate && (
            <div className="flex items-center gap-2 text-[12px] text-gray-600">
              <Icon name="event" size="sm" className="text-gray-400" />
              <span>ILP review due:</span>
              <span className={`font-semibold ${reviewUrgent ? 'text-red-600' : reviewSoon ? 'text-amber-600' : 'text-gray-800'}`}>
                {new Date(student.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Open concerns */}
          {student.openConcerns > 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <Icon name="warning" size="sm" className="text-amber-500" />
              <span className="text-amber-800 font-medium">
                {student.openConcerns} open SEND concern{student.openConcerns !== 1 ? 's' : ''}
              </span>
              <Link href="/senco/concerns" className="ml-auto text-[11px] text-blue-600 hover:underline font-medium">
                View concerns →
              </Link>
            </div>
          )}

          {/* Action links */}
          <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
            <Link
              href={`/students/${student.id}`}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-[11px] text-gray-700 font-medium transition-colors"
            >
              <Icon name="person" size="sm" /> Student file
            </Link>
            {student.ilpId && (
              <Link
                href={`/send/ilp/${student.id}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-[11px] text-blue-700 font-medium transition-colors"
              >
                <Icon name="task_alt" size="sm" /> View ILP
              </Link>
            )}
            <Link
              href="/senco/concerns"
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-[11px] text-amber-700 font-medium transition-colors"
            >
              <Icon name="warning" size="sm" /> Raise concern
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SendCaseloadPanel({ data }: Props) {
  const [classFilter, setClassFilter] = useState<string>('all')

  const filtered = classFilter === 'all'
    ? data.students
    : data.students.filter(s => s.classNames.some(cn => {
        const cls = data.classSummary.find(c => c.classId === classFilter)
        return cls && cn === cls.className
      }))

  const ehcpStudents     = filtered.filter(s => s.sendStatus === 'EHCP')
  const senStudents      = filtered.filter(s => s.sendStatus === 'SEN_SUPPORT')
  const noIlpStudents    = filtered.filter(s => !s.hasIlp)
  const reviewDueStudents = filtered.filter(s => s.reviewDaysUntil != null && s.reviewDaysUntil <= 14)

  if (data.totalSend === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-10 text-center">
        <Icon name="check_circle" size="lg" className="text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-green-900">No SEND students in your classes</p>
        <p className="text-sm text-green-700 mt-1">All students in your classes are not currently on the SEND register.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'SEND students',    value: data.totalSend,      icon: 'groups',    colour: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
          { label: 'SEN Support',      value: data.senSupport,     icon: 'support',   colour: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100' },
          { label: 'With EHCP',        value: data.ehcpCount,      icon: 'description', colour: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'No active ILP',    value: data.noIlpCount,     icon: 'warning',   colour: data.noIlpCount > 0 ? 'text-amber-700' : 'text-gray-300', bg: data.noIlpCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200' },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl p-4 ${k.bg}`}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{k.label}</p>
              <Icon name={k.icon} size="sm" className={k.colour} />
            </div>
            <p className={`text-3xl font-bold ${k.colour}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {noIlpStudents.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <Icon name="warning" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {noIlpStudents.length} student{noIlpStudents.length !== 1 ? 's' : ''} without an approved ILP
            </p>
            <p className="text-[12px] text-amber-700 mt-0.5">
              {noIlpStudents.map(s => `${s.firstName} ${s.lastName}`).join(', ')} — contact the SENCO to create one.
            </p>
          </div>
          <Link href="/senco/concerns" className="shrink-0 text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline">
            Raise concern
          </Link>
        </div>
      )}

      {reviewDueStudents.length > 0 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
          <Icon name="schedule" size="sm" className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{reviewDueStudents.length} ILP review{reviewDueStudents.length !== 1 ? 's' : ''} due within 14 days.</span>
            {' '}You may be asked to provide evidence of progress against targets.
          </p>
        </div>
      )}

      {/* Class filter */}
      {data.classSummary.filter(c => c.sendCount > 0).length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setClassFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              classFilter === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            All classes ({data.totalSend})
          </button>
          {data.classSummary.filter(c => c.sendCount > 0).map(c => (
            <button
              key={c.classId}
              onClick={() => setClassFilter(c.classId)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                classFilter === c.classId
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {c.className} ({c.sendCount})
            </button>
          ))}
        </div>
      )}

      {/* Student list — EHCP first, then SEN Support */}
      {ehcpStudents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
            <Icon name="description" size="sm" /> EHCP students ({ehcpStudents.length})
          </h2>
          {ehcpStudents.map(s => <StudentCard key={s.id} student={s} />)}
        </div>
      )}

      {senStudents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
            <Icon name="support" size="sm" /> SEN Support students ({senStudents.length})
          </h2>
          {senStudents.map(s => <StudentCard key={s.id} student={s} />)}
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap pt-2 border-t border-gray-100">
        <Link href="/classes" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="groups" size="sm" /> My Classes
        </Link>
        <Link href="/senco/concerns" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="warning" size="sm" /> Raise Concern
        </Link>
        <Link href="/senco/ilp" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="task_alt" size="sm" /> ILP Records
        </Link>
      </div>
    </div>
  )
}
