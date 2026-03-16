'use client'
import Link from 'next/link'
import { Folder, Calendar, ChevronRight } from 'lucide-react'

type Plan = {
  id:         string
  status:     string
  reviewDate: Date | string
  student:    { id: string; firstName: string; lastName: string }
  targets:    { id: string; needCategory: string; metricKey: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT:                'bg-gray-100 text-gray-500',
  ACTIVE_INTERNAL:      'bg-green-100 text-green-700',
  ACTIVE_PARENT_SHARED: 'bg-blue-100 text-blue-700',
  ARCHIVED:             'bg-gray-100 text-gray-400',
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    DRAFT:                'Draft',
    ACTIVE_INTERNAL:      'Active',
    ACTIVE_PARENT_SHARED: 'Shared with Parent',
    ARCHIVED:             'Archived',
  }
  return map[s] ?? s
}

function isOverdue(reviewDate: Date | string) {
  return new Date(reviewDate) < new Date()
}

export default function PlansView({ plans, role }: { plans: Plan[]; role: string }) {
  const isSenco = role === 'SENCO'

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">

      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Folder size={20} className="text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">SEND Plans</h1>
          <span className="text-[11px] text-gray-400 font-medium">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
        </div>
        {isSenco && (
          <Link
            href="/send/ilp"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            ILP Records <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Folder size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No active plans</p>
          {isSenco && (
            <Link href="/send/ilp" className="mt-3 text-sm text-blue-600 hover:underline">
              View ILP Records →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map(plan => {
            const overdue = isOverdue(plan.reviewDate)
            return (
              <Link
                key={plan.id}
                href={`/analytics/students/${plan.student.id}`}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                {/* student */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {plan.student.firstName} {plan.student.lastName}
                  </p>
                  {plan.targets.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {plan.targets.map(t => t.needCategory).join(' · ')}
                    </p>
                  )}
                </div>

                {/* status */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${STATUS_STYLES[plan.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {statusLabel(plan.status)}
                </span>

                {/* review date */}
                <div className={`flex items-center gap-1 text-[11px] shrink-0 ${overdue ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                  <Calendar size={11} />
                  {overdue ? 'Review overdue' : `Review ${new Date(plan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                </div>

                <ChevronRight size={14} className="text-gray-300 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
