import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { ClipboardList, AlertTriangle, BookOpen, Plus, ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any

  // Fetch teacher's classes
  const myClasses = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      teachers: { some: { userId } },
    },
    include: {
      _count: { select: { enrolments: true } },
    },
  })

  const classIds = myClasses.map(c => c.id)

  // Recent homework
  const recentHomework = await prisma.homework.findMany({
    where: { schoolId, classId: { in: classIds } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      class: true,
      _count: { select: { submissions: true } },
    },
  })

  // Flagged submissions
  const flaggedSubmissions = await prisma.submission.findMany({
    where: {
      schoolId,
      status: 'UNDER_REVIEW',
      homework: { classId: { in: classIds } },
    },
    include: {
      student: true,
      homework: { include: { class: true } },
      integritySignal: true,
    },
    take: 10,
  })

  // Pending to mark
  const pendingMark = await prisma.submission.findMany({
    where: {
      schoolId,
      status: 'SUBMITTED',
      homework: { classId: { in: classIds } },
    },
    include: {
      student: true,
      homework: { include: { class: true } },
    },
    take: 10,
  })

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Good morning, {firstName} 👋</h1>
              <p className="text-gray-500 mt-1">Here's what needs your attention today</p>
            </div>
            <Link
              href="/homework/new"
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              New Homework
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-bold text-gray-900">{myClasses.length}</div>
              <div className="text-sm text-gray-500 mt-1">My Classes</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-bold text-amber-600">{pendingMark.length}</div>
              <div className="text-sm text-gray-500 mt-1">Submissions to Mark</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-bold text-red-600">{flaggedSubmissions.length}</div>
              <div className="text-sm text-gray-500 mt-1">Integrity Flags</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Flagged Submissions */}
            {flaggedSubmissions.length > 0 && (
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={18} className="text-amber-600" />
                  <h2 className="font-semibold text-amber-900">Integrity Review Required</h2>
                  <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                    {flaggedSubmissions.length} flagged
                  </span>
                </div>
                <div className="space-y-2">
                  {flaggedSubmissions.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          {sub.student.firstName} {sub.student.lastName}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">— {sub.homework.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {Math.round((sub.integritySignal?.pasteCharRatio ?? 0) * 100)}% pasted
                        </span>
                        <Link
                          href={`/homework/${sub.homeworkId}`}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Review <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Classes */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900">My Classes</h2>
              </div>
              <div className="space-y-2">
                {myClasses.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{cls.name}</div>
                      <div className="text-xs text-gray-500">{cls._count.enrolments} students</div>
                    </div>
                    <Link href={`/homework/new?classId=${cls.id}`} className="text-xs text-blue-600 hover:underline">
                      + Homework
                    </Link>
                  </div>
                ))}
                {myClasses.length === 0 && (
                  <p className="text-gray-400 text-sm">No classes assigned yet</p>
                )}
              </div>
            </div>

            {/* Recent Homework */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900">Recent Homework</h2>
              </div>
              <div className="space-y-2">
                {recentHomework.map(hw => (
                  <Link
                    key={hw.id}
                    href={`/homework/${hw.id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-1 transition"
                  >
                    <div>
                      <div className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{hw.title}</div>
                      <div className="text-xs text-gray-500">{hw.class.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        hw.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {hw.status}
                      </span>
                      <span className="text-xs text-gray-500">{hw._count.submissions}</span>
                    </div>
                  </Link>
                ))}
                {recentHomework.length === 0 && (
                  <p className="text-gray-400 text-sm">No homework created yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
