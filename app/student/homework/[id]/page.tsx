import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import HomeworkSubmissionView from '@/components/HomeworkSubmissionView'
import { getStudentHomework } from '@/app/actions/student'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function StudentHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const { id } = await params
  const hw = await getStudentHomework(id)
  if (!hw) notFound()

  const isOverdue  = new Date(hw.dueAt) < new Date() && !hw.submission
  const isReturned = hw.submission?.status === 'RETURNED'
  const isSubmitted = !!hw.submission && !isReturned

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Page header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-start gap-3">
            <Link
              href="/student/dashboard"
              className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            >
              <Icon name="chevron_left" size="sm" />
            </Link>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">{hw.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {hw.class && (
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                    {hw.class.name}
                  </span>
                )}
                {hw.isAdapted && (
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    Adapted for you
                  </span>
                )}
                <span className="text-[11px] text-gray-400">
                  Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {isOverdue && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Overdue</span>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            {isReturned && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">Returned</span>
            )}
            {isSubmitted && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700">Awaiting Feedback</span>
            )}
            {!hw.submission && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-500">To Do</span>
            )}
          </div>
        </div>

        {/* Submission panel */}
        <div className="flex-1 min-h-0 overflow-auto">
          <HomeworkSubmissionView hw={hw} />
        </div>

      </div>
    </AppShell>
  )
}
