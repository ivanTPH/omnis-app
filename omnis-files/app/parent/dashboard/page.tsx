import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { Star, ClipboardList, TrendingUp } from 'lucide-react'

export default async function ParentDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (role !== 'PARENT') redirect('/dashboard')

  // Get linked children
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: userId },
    include: {
      child: {
        include: {
          enrolments: {
            include: { class: true },
          },
        },
      },
    },
  })

  const children = links.map(l => l.child)

  // Get homework and submissions for each child
  const childData = await Promise.all(
    children.map(async (child) => {
      const classIds = child.enrolments.map(e => e.classId)

      const homework = await prisma.homework.findMany({
        where: {
          schoolId,
          classId: { in: classIds },
          status: 'PUBLISHED',
          OR: [
            { isAdapted: false, adaptedFor: null },
            { isAdapted: true, adaptedFor: child.id },
          ],
        },
        include: {
          class: true,
          submissions: {
            where: { studentId: child.id },
            select: { grade: true, status: true, submittedAt: true, feedback: true },
          },
        },
        orderBy: { dueAt: 'desc' },
        take: 10,
      })

      // Remove adapted flags from parent view
      const cleanHomework = homework.map(hw => {
        const { isAdapted, adaptedFor, modelAnswer, gradingBands, ...safe } = hw as any
        return safe
      })

      const graded = cleanHomework.filter(hw => hw.submissions[0]?.grade)
      const pending = cleanHomework.filter(hw => !hw.submissions[0])

      return { child, homework: cleanHomework, graded, pending }
    })
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {firstName}</h1>
            <p className="text-gray-500 mt-1">Your child's progress at {schoolName}</p>
          </div>

          {childData.map(({ child, homework, graded, pending }) => (
            <div key={child.id} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 font-semibold">{child.firstName[0]}{child.lastName[0]}</span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{child.firstName} {child.lastName}</h2>
                  <p className="text-sm text-gray-500">Year {child.yearGroup}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-amber-600">{pending.length}</div>
                  <div className="text-sm text-gray-500">Homework Due</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-green-600">{graded.length}</div>
                  <div className="text-sm text-gray-500">Graded</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-gray-900">{homework.length}</div>
                  <div className="text-sm text-gray-500">Total Set</div>
                </div>
              </div>

              {/* Recent homework */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-medium text-gray-900">Recent Homework</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {homework.slice(0, 6).map((hw: any) => {
                    const sub = hw.submissions[0]
                    return (
                      <div key={hw.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{hw.title}</div>
                          <div className="text-xs text-gray-500">{hw.class.name} · Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                        </div>
                        <div>
                          {sub?.grade ? (
                            <span className="bg-green-100 text-green-800 font-bold text-sm px-3 py-1 rounded-lg">
                              {sub.grade}
                            </span>
                          ) : sub ? (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Submitted</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">Pending</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {children.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p>No children linked to your account yet.</p>
              <p className="text-sm mt-1">Please contact the school admin.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
