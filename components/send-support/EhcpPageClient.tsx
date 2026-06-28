'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import SendBadge from '@/components/ui/SendBadge'
import { SencoRow } from '@/components/ui/SencoRow'
import type { EhcpPlanWithOutcomes, StudentWithoutEhcp } from '@/app/actions/ehcp'
import EhcpCard from './EhcpCard'

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  under_review: 'Under Review',
  ceased: 'Ceased',
}

const STATUS_COLOUR: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  under_review: 'bg-yellow-100 text-yellow-800',
  ceased:       'bg-gray-100 text-gray-600',
}

function daysUntil(date: Date) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

type Props = {
  plans: EhcpPlanWithOutcomes[]
  studentsWithoutEhcp: StudentWithoutEhcp[]
  isSenco: boolean
}

export default function EhcpPageClient({ plans, studentsWithoutEhcp, isSenco }: Props) {
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [yearFilter,  setYearFilter]  = useState('')
  const [viewMode,    setViewMode]    = useState<'plans' | 'no_ehcp'>('plans')

  const pendingApproval = plans.filter(p => !p.approvedBySenco)
  // Count ALL plans regardless of approval status — unapproved plans still have statutory review deadlines
  const overdue     = plans.filter(p => daysUntil(p.reviewDate) < 0)
  const dueWithin30 = plans.filter(p => { const d = daysUntil(p.reviewDate); return d >= 0 && d <= 30 })
  const onTrack     = plans.filter(p => daysUntil(p.reviewDate) > 30)

  // Year options from both plans and students-without-EHCP
  const yearOptions = useMemo(() => {
    const years = new Set([
      ...plans.map(p => p.yearGroup).filter((y): y is number => y != null),
      ...studentsWithoutEhcp.map(s => s.yearGroup).filter((y): y is number => y != null),
    ])
    return [...years].sort((a, b) => a - b)
  }, [plans, studentsWithoutEhcp])

  const filteredPlans = useMemo(() => plans.filter(p => {
    if (yearFilter && p.yearGroup !== Number(yearFilter)) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!p.studentName.toLowerCase().includes(q)) return false
    }
    return true
  }), [plans, yearFilter, searchQuery])

  const filteredWithoutEhcp = useMemo(() => studentsWithoutEhcp.filter(s => {
    if (yearFilter && s.yearGroup !== Number(yearFilter)) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!s.studentName.toLowerCase().includes(q)) return false
    }
    return true
  }), [studentsWithoutEhcp, yearFilter, searchQuery])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card-stat">
          <div className="flex items-center justify-between">
            <p className="text-label">REVIEW OVERDUE</p>
            <Icon name="warning" size="sm" className="text-red-500" />
          </div>
          <p className="text-3xl font-semibold text-red-600 mt-1">{overdue.length}</p>
          <p className="text-meta">{overdue.length > 0 ? 'Requires attention' : 'None overdue'}</p>
        </div>
        <div className="card-stat">
          <div className="flex items-center justify-between">
            <p className="text-label">DUE WITHIN 30 DAYS</p>
            <Icon name="schedule" size="sm" className="text-amber-500" />
          </div>
          <p className="text-3xl font-semibold text-amber-600 mt-1">{dueWithin30.length}</p>
          <p className="text-meta">{dueWithin30.length > 0 ? 'Schedule annual reviews' : 'None due soon'}</p>
        </div>
        <div className="card-stat">
          <div className="flex items-center justify-between">
            <p className="text-label">ON TRACK</p>
            <Icon name="check_circle" size="sm" className="text-green-500" />
          </div>
          <p className="text-3xl font-semibold text-green-600 mt-1">{onTrack.length}</p>
          <p className="text-meta">{onTrack.length > 0 ? 'Reviews scheduled' : 'No active plans'}</p>
        </div>
        <div className="card-stat">
          <div className="flex items-center justify-between">
            <p className="text-label">AWAITING APPROVAL</p>
            <Icon name="pending" size="sm" className="text-purple-500" />
          </div>
          <p className="text-3xl font-semibold text-purple-700 mt-1">{pendingApproval.length}</p>
          <p className="text-meta">{pendingApproval.length > 0 ? 'SENCO sign-off needed' : 'All plans signed off'}</p>
        </div>
      </div>

      {/* UK GDPR notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <Icon name="warning" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          EHCP data is Special Category under UK GDPR (Article 9). Access is logged. Do not share outside authorised staff.
          All annual reviews also require Local Authority sign-off.
        </p>
      </div>

      {/* Toolbar: view mode + search + year filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('plans')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${viewMode === 'plans' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            EHCP Plans ({plans.length})
          </button>
          {studentsWithoutEhcp.length > 0 && (
            <button
              onClick={() => setViewMode('no_ehcp')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'no_ehcp' ? 'bg-amber-500 text-white' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
            >
              <Icon name="warning" size="sm" />
              SEND without EHCP ({studentsWithoutEhcp.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by student name…"
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">All years</option>
            {yearOptions.map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>

      {/* SEND without EHCP view */}
      {viewMode === 'no_ehcp' ? (
        filteredWithoutEhcp.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="check_circle" size="lg" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">All SEND students have an EHCP plan.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {filteredWithoutEhcp.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{s.studentName}</p>
                  <p className="text-[11px] text-gray-500">
                    {s.yearGroup ? `Year ${s.yearGroup}` : ''}
                    {s.yearGroup && s.needArea ? ' · ' : ''}
                    {s.needArea ?? s.sendStatus.replace(/_/g, ' ')}
                  </p>
                </div>
                <SendBadge status={s.sendStatus as 'EHCP' | 'SEN_SUPPORT'} showTier />
                <a
                  href={`/student/${s.id}/send`}
                  className="text-[11px] text-purple-600 hover:underline"
                >
                  View record →
                </a>
              </div>
            ))}
          </div>
        )
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="task_alt" size="lg" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery || yearFilter ? 'No plans match your search.' : 'No active EHCP plans recorded.'}</p>
        </div>
      ) : (
        <div className="space-y-0">
          {filteredPlans.map(plan => {
            const days      = daysUntil(plan.reviewDate)
            const isOverdue = days < 0
            const isDueSoon = days >= 0 && days <= 30
            const achieved  = plan.outcomes.filter(o => o.status === 'achieved').length
            const isAiDraft    = plan.autoGenerated && !plan.approvedBySenco
            const needsApproval = !plan.approvedBySenco
            const initials  = plan.studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            const avatarColour = needsApproval ? 'bg-amber-400' : isOverdue ? 'bg-red-400' : isDueSoon ? 'bg-amber-400' : 'bg-purple-400'

            const badges = [
              ...(isAiDraft ? [{ label: 'AI draft', variant: 'custom' as const, customClass: 'text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1' }] : []),
              needsApproval
                ? { label: 'Needs SENCO approval', variant: 'draft' as const }
                : { label: STATUS_LABEL[plan.status] ?? plan.status, variant: 'custom' as const, customClass: `text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOUR[plan.status] ?? 'bg-gray-100 text-gray-600'}` },
            ]

            return (
              <SencoRow
                key={plan.id}
                studentName={plan.studentName}
                studentInitials={initials}
                avatarColour={avatarColour}
                meta={[
                  { label: 'LA',            value: plan.localAuthority },
                  { label: 'PLAN DATE',     value: new Date(plan.planDate).toLocaleDateString('en-GB') },
                  { label: 'CO-ORDINATOR', value: plan.coordinatorName ?? '—' },
                  { label: 'OUTCOMES',      value: `${achieved}/${plan.outcomes.length} achieved` },
                ]}
                badges={badges}
                rightContent={
                  needsApproval ? (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      Expand to review &amp; approve
                    </span>
                  ) : (
                    <span className={`text-sm font-semibold ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-gray-500'}`}>
                      {isOverdue ? `${Math.abs(days)}d overdue` : `Review in ${days}d`}
                    </span>
                  )
                }
                isExpanded={expanded.has(plan.id)}
                onToggle={() => toggleExpand(plan.id)}
              >
                <EhcpCard plan={plan} isSenco={isSenco} />
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{plan.outcomes.filter(o => o.evidenceCount > 0).length} of {plan.outcomes.length} outcomes have evidence</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/export/ehcp-plan/${plan.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium"
                    >
                      <Icon name="picture_as_pdf" size="sm" /> Export Plan PDF
                    </a>
                    <Link href={`/student/${plan.studentId}/send`} className="text-purple-600 hover:underline">
                      View student SEND record →
                    </Link>
                  </div>
                </div>
              </SencoRow>
            )
          })}
        </div>
      )}
    </div>
  )
}
