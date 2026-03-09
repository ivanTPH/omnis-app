import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTodaysCoverSummary, getCoverHistory, getStaffList } from '@/app/actions/cover'
import CoverPageTabs from '@/components/cover/CoverPageTabs'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER']

export default async function CoverPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  if (!ALLOWED.includes(user.role)) redirect('/dashboard')

  const today = new Date()

  const [summary, history, staffRaw] = await Promise.all([
    getTodaysCoverSummary(user.schoolId, today),
    getCoverHistory(user.schoolId),
    getStaffList(user.schoolId),
  ])

  const staffList = staffRaw.map((s: {
    id: string
    firstName: string
    lastName: string
    title: string | null
  }) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, title: s.title }))

  return (
    <div className="flex flex-col h-full p-6 gap-4 min-h-0">
      <div className="flex-shrink-0">
        <h1 className="text-[20px] font-bold text-gray-900">Cover Management</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          {today.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      <CoverPageTabs
        today={today}
        schoolId={user.schoolId}
        summary={summary}
        history={history}
        staffList={staffList}
      />
    </div>
  )
}
