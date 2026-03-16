import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import HomeworkMarkingView from '@/components/HomeworkMarkingView'
import { getHomeworkForMarking } from '@/app/actions/homework'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function HomeworkMarkingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const { id } = await params
  const hw = await getHomeworkForMarking(id)
  if (!hw) notFound()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Page header */}
        <div className="flex items-start px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-start gap-3">
            <Link href="/homework" className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
              <ChevronLeft size={16} />
            </Link>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">{hw.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {hw.class && (
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                    {hw.class.name}
                  </span>
                )}
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  hw.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                  hw.status === 'CLOSED'    ? 'bg-gray-200 text-gray-500'   :
                  'bg-amber-100 text-amber-700'
                }`}>{hw.status}</span>
                <span className="text-[11px] text-gray-400">
                  Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {hw.lesson && (
                  <span className="text-[11px] text-gray-400">↳ {hw.lesson.title}</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Split-panel marking view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <HomeworkMarkingView hw={hw} />
        </div>

      </div>
    </AppShell>
  )
}
