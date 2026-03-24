'use client'
import Link from 'next/link'
import { FileHeart, Shield, Calendar, ChevronRight, Folder } from 'lucide-react'
import StudentAvatar from '@/components/StudentAvatar'

type IlpRow = {
  id:           string
  status:       string
  sendCategory: string
  areasOfNeed:  string
  reviewDate:   Date | string
  student:      { id: string; firstName: string; lastName: string }
  targets:      { id: string; status: string }[]
}

type EhcpRow = {
  id:             string
  status:         string
  localAuthority: string
  reviewDate:     Date | string
  student:        { id: string; firstName: string; lastName: string }
}

const ILP_STATUS: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  under_review: 'bg-amber-100 text-amber-700',
  archived:     'bg-gray-100 text-gray-400',
}

const ILP_LABEL: Record<string, string> = {
  active:       'Active',
  under_review: 'Under review',
  archived:     'Archived',
}

function isOverdue(reviewDate: Date | string) {
  return new Date(reviewDate) < new Date()
}

function ReviewDate({ date }: { date: Date | string }) {
  const overdue = isOverdue(date)
  return (
    <div className={`flex items-center gap-1 text-[11px] shrink-0 ${overdue ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
      <Calendar size={11} />
      {overdue
        ? 'Review overdue'
        : `Review ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
    </div>
  )
}

export default function PlansView({
  ilps,
  ehcps,
  role,
}: {
  ilps:  IlpRow[]
  ehcps: EhcpRow[]
  role:  string
}) {
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)
  const total   = ilps.length + ehcps.length

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Folder size={20} className="text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">SEND Plans</h1>
          <span className="text-[11px] text-gray-400 font-medium">
            {total} plan{total !== 1 ? 's' : ''}
          </span>
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

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Folder size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No active SEND plans for your students</p>
          {isSenco && (
            <Link href="/send/ilp" className="mt-3 text-sm text-blue-600 hover:underline">
              View ILP Records →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-5">

          {/* ILPs */}
          {ilps.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileHeart size={11} /> Individual Learning Plans ({ilps.length})
              </p>
              <div className="space-y-2">
                {ilps.map(ilp => {
                  const activeTargets = ilp.targets.filter(t => t.status === 'active').length
                  return (
                    <Link
                      key={ilp.id}
                      href={`/student/${ilp.student.id}/send`}
                      className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    >
                      <StudentAvatar
                        firstName={ilp.student.firstName}
                        lastName={ilp.student.lastName}
                        size="sm"
                        sendStatus="SEN_SUPPORT"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {ilp.student.firstName} {ilp.student.lastName}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                          {ilp.sendCategory}{activeTargets > 0 ? ` · ${activeTargets} active target${activeTargets !== 1 ? 's' : ''}` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${ILP_STATUS[ilp.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {ILP_LABEL[ilp.status] ?? ilp.status}
                      </span>
                      <ReviewDate date={ilp.reviewDate} />
                      <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* EHCPs */}
          {ehcps.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Shield size={11} /> EHCP Plans ({ehcps.length})
              </p>
              <div className="space-y-2">
                {ehcps.map(ehcp => (
                  <Link
                    key={ehcp.id}
                    href={`/student/${ehcp.student.id}/send`}
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition-colors"
                  >
                    <StudentAvatar
                      firstName={ehcp.student.firstName}
                      lastName={ehcp.student.lastName}
                      size="sm"
                      sendStatus="EHCP"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {ehcp.student.firstName} {ehcp.student.lastName}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        EHCP · {ehcp.localAuthority}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 bg-purple-100 text-purple-700">
                      EHCP
                    </span>
                    <ReviewDate date={ehcp.reviewDate} />
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
