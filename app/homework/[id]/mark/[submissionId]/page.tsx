import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SubmissionMarkingView from '@/components/SubmissionMarkingView'
import { getSubmissionForMarking } from '@/app/actions/homework'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function SubmissionMarkingPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const { id: homeworkId, submissionId } = await params
  const data = await getSubmissionForMarking(submissionId)
  if (!data) notFound()

  const hw      = data.homework
  const student = data.student
  const nav     = data.nav

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/homework/${homeworkId}`}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700 shrink-0"
            >
              <Icon name="chevron_left" size="sm" />
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 truncate">{hw.title}</p>
              <p className="text-[15px] font-bold text-gray-900 leading-tight">
                {student.firstName} {student.lastName}
              </p>
            </div>
          </div>

          {/* Prev / Next navigation */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[12px] text-gray-400 mr-1">
              {nav.current} of {nav.total}
            </span>
            <Link
              href={nav.prev ? `/homework/${homeworkId}/mark/${nav.prev}` : '#'}
              aria-disabled={!nav.prev}
              className={`p-1.5 rounded-lg border transition-colors ${
                nav.prev
                  ? 'border-gray-200 hover:bg-gray-100 text-gray-600'
                  : 'border-gray-100 text-gray-300 pointer-events-none'
              }`}
            >
              <Icon name="chevron_left" size="sm" />
            </Link>
            <Link
              href={nav.next ? `/homework/${homeworkId}/mark/${nav.next}` : '#'}
              aria-disabled={!nav.next}
              className={`p-1.5 rounded-lg border transition-colors ${
                nav.next
                  ? 'border-gray-200 hover:bg-gray-100 text-gray-600'
                  : 'border-gray-100 text-gray-300 pointer-events-none'
              }`}
            >
              <Icon name="chevron_right" size="sm" />
            </Link>
          </div>
        </div>

        {/* Main content — client component handles the form */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <SubmissionMarkingView data={data as any} homeworkId={homeworkId} />
        </div>

      </div>
    </AppShell>
  )
}
