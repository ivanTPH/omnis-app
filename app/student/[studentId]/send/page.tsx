import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getStudentConcerns, getStudentIlp, getEarlyWarningFlags } from '@/app/actions/send-support'
import { prisma } from '@/lib/prisma'
import ConcernList from '@/components/send-support/ConcernList'
import IlpCard from '@/components/send-support/IlpCard'
import EarlyWarningPanel from '@/components/send-support/EarlyWarningPanel'
import RaiseConcernButton from '@/components/send-support/RaiseConcernButton'
import { AlertTriangle, FileText } from 'lucide-react'
import StudentAvatar from '@/components/StudentAvatar'

const ALLOWED = ['SENCO', 'SLT', 'HEAD_OF_YEAR', 'SCHOOL_ADMIN']

export default async function StudentSendPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { role: string; schoolId: string }
  if (!ALLOWED.includes(user.role)) redirect('/dashboard')

  const { studentId } = await params

  const [student, sendStatus, concerns, ilp, allFlags] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, schoolId: user.schoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true, yearGroup: true, avatarUrl: true },
    }),
    prisma.sendStatus.findFirst({
      where: { studentId },
      select: { activeStatus: true, needArea: true },
    }),
    getStudentConcerns(studentId),
    getStudentIlp(studentId),
    getEarlyWarningFlags(),
  ])

  if (!student) redirect('/dashboard')

  const studentName = `${student.firstName} ${student.lastName}`
  const flags = allFlags.filter(f => f.studentId === studentId)

  const statusColour =
    sendStatus?.activeStatus === 'EHCP'        ? 'bg-purple-100 text-purple-700' :
    sendStatus?.activeStatus === 'SEN_SUPPORT' ? 'bg-amber-100  text-amber-700'  :
                                                 'bg-gray-100   text-gray-600'

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StudentAvatar
            firstName={student.firstName}
            lastName={student.lastName}
            avatarUrl={student.avatarUrl}
            size="md"
          />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{studentName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {student.yearGroup && (
                <span className="text-sm text-gray-500">Year {student.yearGroup}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColour}`}>
                {sendStatus?.activeStatus?.replace(/_/g, ' ') ?? 'No SEND status'}
              </span>
              {sendStatus?.needArea && (
                <span className="text-xs text-gray-500">{sendStatus.needArea}</span>
              )}
            </div>
          </div>
        </div>
        <RaiseConcernButton
          studentId={student.id}
          studentName={studentName}
          variant="button"
        />
      </div>

      <div className="p-6 space-y-6">

        {/* Early Warning Flags for this student */}
        {flags.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Early Warning Flags</h2>
            </div>
            <EarlyWarningPanel flags={flags} compact />
          </section>
        )}

        {/* ILP */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-blue-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Individual Learning Plan</h2>
          </div>
          {ilp ? (
            <IlpCard ilp={ilp} />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
              No active ILP for this student.
            </div>
          )}
        </section>

        {/* Concerns */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-gray-900 text-sm">
              SEND Concerns
              {concerns.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-500">({concerns.length})</span>
              )}
            </h2>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <ConcernList concerns={concerns} isSenco={user.role === 'SENCO'} />
          </div>
        </section>
      </div>
    </div>
  )
}
