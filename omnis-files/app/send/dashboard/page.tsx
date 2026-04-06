import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { Heart, AlertCircle, Clock, CheckCircle } from 'lucide-react'

export default async function SendDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const ilps = await prisma.iLP.findMany({
    where: { schoolId },
    include: {
      targets: true,
      notes: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Get student details
  const studentIds = ilps.map(i => i.studentId)
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, schoolId },
    select: { id: true, firstName: true, lastName: true, yearGroup: true },
  })
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))

  const now = new Date()
  const reviewDue = ilps.filter(i => i.reviewDueAt && new Date(i.reviewDueAt) <= now && i.status === 'ACTIVE')
  const active = ilps.filter(i => i.status === 'ACTIVE')
  const draft = ilps.filter(i => i.status === 'DRAFT')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} firstName={firstName} lastName={lastName} schoolName={schoolName} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">SEND Dashboard</h1>
            <p className="text-gray-500 mt-1">Individual Learning Plans and SEND oversight</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-bold text-blue-600">{active.length}</div>
              <div className="text-sm text-gray-500 mt-1">Active ILPs</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-bold text-amber-600">{draft.length}</div>
              <div className="text-sm text-gray-500 mt-1">Draft ILPs</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`text-3xl font-bold ${reviewDue.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {reviewDue.length}
              </div>
              <div className="text-sm text-gray-500 mt-1">Reviews Due</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-bold text-gray-900">{ilps.length}</div>
              <div className="text-sm text-gray-500 mt-1">Total Students</div>
            </div>
          </div>

          {/* Reviews Due */}
          {reviewDue.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={18} className="text-red-600" />
                <h2 className="font-semibold text-red-900">Reviews Overdue</h2>
              </div>
              <div className="space-y-2">
                {reviewDue.map(ilp => {
                  const student = studentMap[ilp.studentId]
                  return (
                    <Link key={ilp.id} href={`/send/ilp/${ilp.studentId}`}
                      className="flex items-center justify-between bg-white rounded-lg px-4 py-3 hover:bg-red-50 transition">
                      <div className="font-medium text-gray-900">
                        {student?.firstName} {student?.lastName}
                        <span className="text-gray-500 font-normal ml-2 text-sm">Year {student?.yearGroup}</span>
                      </div>
                      <span className="text-sm text-red-600">
                        Due {new Date(ilp.reviewDueAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* All ILPs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Heart size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">All ILP Records</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {ilps.map(ilp => {
                const student = studentMap[ilp.studentId]
                const statusColour = {
                  ACTIVE: 'bg-green-100 text-green-700',
                  DRAFT: 'bg-gray-100 text-gray-600',
                  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
                  ARCHIVED: 'bg-gray-100 text-gray-400',
                }[ilp.status]

                return (
                  <Link key={ilp.id} href={`/send/ilp/${ilp.studentId}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                    <div>
                      <div className="font-medium text-gray-900">
                        {student?.firstName} {student?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        Year {student?.yearGroup} · {ilp.targets.length} targets · {ilp.notes.length} notes
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {ilp.reviewDueAt && (
                        <span className="text-xs text-gray-500">
                          Review {new Date(ilp.reviewDueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColour}`}>
                        {ilp.status}
                      </span>
                    </div>
                  </Link>
                )
              })}
              {ilps.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400">
                  <Heart size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No ILP records yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
