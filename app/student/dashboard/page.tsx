import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ExportPdfButton from '@/components/ExportPdfButton'

export default async function StudentDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const enrolments = await prisma.enrolment.findMany({ where: { userId }, select: { classId: true } })
  const classIds = enrolments.map((e: any) => e.classId)

  const allHw = await prisma.homework.findMany({
    where: { schoolId, classId: { in: classIds }, status: 'PUBLISHED', OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: userId }] },
    include: { class: true, submissions: { where: { studentId: userId }, select: { id: true, status: true, grade: true, submittedAt: true } } },
    orderBy: { dueAt: 'asc' },
  })

  // Prefer adapted version for same lesson
  const map = new Map<string, any>()
  for (const hw of allHw) {
    const key = hw.lessonId ?? hw.id
    if (hw.isAdapted || !map.has(key)) map.set(key, hw)
  }
  const homework = Array.from(map.values())
  const now = new Date()
  const pending = homework.filter((hw: any) => !hw.submissions[0])
  const overdue = pending.filter((hw: any) => new Date(hw.dueAt) < now)
  const upcoming = pending.filter((hw: any) => new Date(hw.dueAt) >= now)
  const graded = homework.filter((hw: any) => hw.submissions[0]?.grade)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Welcome back, {firstName} 👋</h1><p className="text-gray-500 mt-1">Your homework overview</p></div>
            <ExportPdfButton href={`/api/export/homework-summary?studentId=${userId}`} filename={`homework-summary.pdf`} label="Export Summary" />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className={`text-3xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{pending.length}</div><div className="text-sm text-gray-500 mt-1">To Do</div>{overdue.length > 0 && <div className="text-xs text-red-600 mt-1">{overdue.length} overdue</div>}</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-amber-600">{homework.filter((hw: any) => hw.submissions[0] && !hw.submissions[0].grade).length}</div><div className="text-sm text-gray-500 mt-1">Awaiting Feedback</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-green-600">{graded.length}</div><div className="text-sm text-gray-500 mt-1">Graded</div></div>
          </div>
          {overdue.length > 0 && <div className="mb-6"><h2 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><Icon name="schedule" size="sm" />Overdue</h2><div className="space-y-2">{overdue.map((hw: any) => <Link key={hw.id} href={`/student/homework/${hw.id}`} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-4 hover:bg-red-100 transition"><div><div className="font-medium text-gray-900">{hw.title}</div><div className="text-sm text-gray-500">{hw.class.name}</div></div><div className="text-sm text-red-600 font-medium">Due {new Date(hw.dueAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div></Link>)}</div></div>}
          {upcoming.length > 0 && <div className="mb-6"><h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Icon name="assignment" size="sm" />To Do</h2><div className="space-y-2">{upcoming.map((hw: any) => { const days = Math.ceil((new Date(hw.dueAt).getTime()-now.getTime())/(1000*60*60*24)); return <Link key={hw.id} href={`/student/homework/${hw.id}`} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:bg-blue-50 hover:border-blue-200 transition"><div><div className="font-medium text-gray-900">{hw.title}</div><div className="text-sm text-gray-500">{hw.class.name}</div></div><div className={`text-sm font-medium ${days<=2?'text-amber-600':'text-gray-500'}`}>{days===1?'Due tomorrow':`${days} days left`}</div></Link>})}</div></div>}
          {graded.length > 0 && <div><h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Icon name="star" size="sm" />Recently Graded</h2><div className="space-y-2">{graded.slice(0,5).map((hw: any) => <Link key={hw.id} href={`/student/homework/${hw.id}`} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:bg-gray-50 transition"><div><div className="font-medium text-gray-900">{hw.title}</div><div className="text-sm text-gray-500">{hw.class.name}</div></div><div className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-lg">{hw.submissions[0].grade}</div></Link>)}</div></div>}
          {homework.length === 0 && <div className="text-center py-16 text-gray-400"><Icon name="assignment" size="lg" className="mx-auto mb-3 opacity-30" /><p>No homework assigned yet</p></div>}
        </div>
      </main>
    </AppShell>
  )
}
