import { requireAuth }             from '@/lib/session'
import { redirect }                 from 'next/navigation'
import AppShell                     from '@/components/AppShell'
import Link                         from 'next/link'
import Icon                         from '@/components/ui/Icon'
import { getTeacherSendCaseload }   from '@/app/actions/teacher-send'
import SendCaseloadPanel            from '@/components/teacher/SendCaseloadPanel'

export const dynamic = 'force-dynamic'

const ALLOWED = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SLT','SCHOOL_ADMIN']

export default async function SendCaseloadPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const data = await getTeacherSendCaseload()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/classes" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Icon name="chevron_left" size="sm" /> My Classes
                </Link>
              </div>
              <h1 className="text-[22px] font-bold text-gray-900">My SEND Students</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {data.totalSend} student{data.totalSend !== 1 ? 's' : ''} on the SEND register across your classes
              </p>
            </div>
            {data.reviewsDue14d > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                <Icon name="schedule" size="sm" />
                {data.reviewsDue14d} review{data.reviewsDue14d !== 1 ? 's' : ''} due
              </span>
            )}
          </div>

          <SendCaseloadPanel data={data} />

        </div>
      </main>
    </AppShell>
  )
}
