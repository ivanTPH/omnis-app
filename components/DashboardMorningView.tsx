'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDashboardData, type DashboardData } from '@/app/actions/dashboard'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCardSkeleton, StudentListSkeleton, HomeworkCardSkeleton } from '@/components/ui/skeletons'
import Icon from '@/components/ui/Icon'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function StatCard({
  label, value, icon, trend, iconDanger,
}: {
  label: string; value: number; icon: string; trend: string; iconDanger?: boolean
}) {
  return (
    <div className="card-stat">
      <div className="flex items-center justify-between">
        <p className="text-label">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon name={icon} size="sm" className={iconDanger ? 'text-red-500' : 'text-gray-500'} />
        </div>
      </div>
      <p className="text-3xl font-semibold text-gray-900 mt-2">{value}</p>
      <p className="text-meta mt-1">{trend}</p>
    </div>
  )
}

export default function DashboardMorningView({ firstName }: { firstName: string }) {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    getDashboardData().then(setData).catch(console.error)
  }, [])

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Stat card derived values
  const totalUngraded  = data?.homeworkToMark.reduce((s, h) => s + h.ungradedCount, 0) ?? 0
  const nextLesson     = data?.todaysLessons[0]
    ? `Next: ${formatTime(data.todaysLessons[0].scheduledAt)} — ${data.todaysLessons[0].className}`
    : 'No more today'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Here's your day at a glance"
      />

      {/* ROW 1 — stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {!data ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon="calendar_today"
              label="TODAY'S LESSONS"
              value={data.todaysLessons.length}
              trend={nextLesson}
            />
            <StatCard
              icon="assignment"
              label="TO MARK"
              value={data.homeworkToMark.length}
              trend={`${totalUngraded} submission${totalUngraded !== 1 ? 's' : ''} waiting`}
            />
            <StatCard
              icon="inbox"
              label="SUBMITTED TODAY"
              value={data.submissionsToday}
              trend={data.submissionsToday === 0 ? 'None yet today' : `Across ${data.homeworkToMark.length} assignment${data.homeworkToMark.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              icon="flag"
              label="OPEN CONCERNS"
              value={data.openConcernsCount}
              trend={data.openConcernsCount > 0 ? 'Requires attention' : 'All clear'}
              iconDanger={data.openConcernsCount > 0}
            />
          </>
        )}
      </div>

      {/* ROW 2 — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — Today's lessons */}
        <div className="card">
          <p className="text-section-header mb-4">Today&apos;s Lessons</p>
          {!data ? (
            <StudentListSkeleton />
          ) : data.todaysLessons.length === 0 ? (
            <EmptyState icon="calendar_today" title="No lessons today" size="sm" />
          ) : (
            <div>
              {data.todaysLessons.map(lesson => (
                <a
                  key={lesson.id}
                  href={`/dashboard?open=${lesson.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 -mx-1 transition-colors"
                >
                  <div className="w-16 text-center flex-shrink-0">
                    <p className="text-xs font-medium text-blue-700 bg-blue-50 rounded px-2 py-1">
                      {formatTime(lesson.scheduledAt)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-data truncate">{lesson.title}</p>
                    <p className="text-meta">{lesson.className} · {lesson.subject}</p>
                  </div>
                  <Icon name="chevron_right" size="sm" className="text-gray-400" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Homework to mark */}
        <div className="card">
          <p className="text-section-header mb-4">Homework to Mark</p>
          {!data ? (
            <div className="space-y-3">
              <HomeworkCardSkeleton />
              <HomeworkCardSkeleton />
              <HomeworkCardSkeleton />
            </div>
          ) : data.homeworkToMark.length === 0 ? (
            <EmptyState
              icon="check_circle"
              title="All marked"
              description="No outstanding submissions"
              size="sm"
            />
          ) : (
            <div>
              {data.homeworkToMark.map(hw => (
                <Link
                  key={hw.id}
                  href={`/homework/${hw.id}/mark`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 -mx-1 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-data truncate">{hw.title}</p>
                    <p className="text-meta">{hw.ungradedCount} ungraded · due {formatDate(hw.dueAt)}</p>
                  </div>
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex-shrink-0">
                    {hw.ungradedCount} to mark
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ROW 3 — open concerns (only when flagCount > 0) */}
      {data && data.openConcernsCount > 0 && (
        <div className="card mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-section-header">Open Concerns</p>
            <Link href="/senco/concerns" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View all →
            </Link>
          </div>
          {data.openConcerns.map(concern => (
            <div key={concern.id} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100 mb-2 last:mb-0">
              <Icon name="flag" size="sm" className="text-red-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-data">{concern.studentName}</p>
                <p className="text-meta truncate">{concern.description}</p>
              </div>
              <p className="text-meta flex-shrink-0">{formatDate(concern.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
