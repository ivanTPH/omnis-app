import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'
import { prisma } from '@/lib/prisma'

const RISK_STYLES: Record<string, string> = {
  LOW:    'bg-amber-100 text-amber-700',
  MEDIUM: 'bg-orange-100 text-orange-700',
  HIGH:   'bg-rose-100 text-rose-700',
}

function relativeTime(iso: Date | string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function HoyIntegrityPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName, schoolId } = session.user as any
  if (!['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  // Flagged signals scoped to school via submission → student
  const signals = await prisma.submissionIntegritySignal.findMany({
    where: {
      riskLevel: { in: ['LOW', 'MEDIUM', 'HIGH'] as any[] },
      attempt: {
        submission: { student: { schoolId } },
      },
    },
    include: {
      attempt: {
        include: {
          submission: {
            include: {
              student:  { select: { firstName: true, lastName: true } },
              homework: { select: { title: true, class: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })

  const patternCases = await prisma.integrityPatternCase.findMany({
    where: { schoolId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    take: 20,
  })

  const caseStudentIds = [...new Set(patternCases.map(c => c.studentId))]
  const caseStudents   = caseStudentIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: caseStudentIds } },
    select: { id: true, firstName: true, lastName: true },
  }) : []
  const studentMap = new Map(caseStudents.map(s => [s.id, s]))

  const highCount = signals.filter(s => s.riskLevel === 'HIGH').length
  const medCount  = signals.filter(s => s.riskLevel === 'MEDIUM').length

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-page-title">Academic Integrity</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            Submission integrity signals collected automatically when students complete homework
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{signals.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Total flagged</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-rose-700">{highCount}</p>
            <p className="text-[11px] text-rose-500 mt-0.5">High risk</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-orange-700">{medCount}</p>
            <p className="text-[11px] text-orange-500 mt-0.5">Medium risk</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-amber-700">{patternCases.length}</p>
            <p className="text-[11px] text-amber-500 mt-0.5">Open pattern cases</p>
          </div>
        </div>

        {/* Flagged submissions */}
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-gray-900 mb-3">Flagged Submissions</h2>
          {signals.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <Icon name="verified" size="lg" className="mx-auto mb-2 text-green-500" />
              <p className="text-[13px] text-green-700 font-medium">No integrity flags detected</p>
              <p className="text-[11px] text-green-600 mt-1">All recent submissions appear authentic</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Homework</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Risk</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">Paste %</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">Focus lost</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {signals.map(s => {
                    const student = s.attempt.submission.student
                    const hw      = s.attempt.submission.homework
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[180px] truncate">
                          {hw.title}
                          <span className="text-gray-400 ml-1 text-[11px]">({hw.class.name})</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${RISK_STYLES[s.riskLevel] ?? 'bg-gray-100 text-gray-500'}`}>
                            {s.riskLevel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">
                          {Math.round(s.pasteRatio * 100)}%
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">
                          {s.focusLostCount}×
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                          {relativeTime(s.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pattern cases */}
        {patternCases.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[14px] font-semibold text-gray-900 mb-3">Pattern Cases</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Triggers</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Subjects</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patternCases.map(c => {
                    const student = studentMap.get(c.studentId)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {student ? `${student.firstName} ${student.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 font-semibold">{c.triggerCount}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.subjectCount}</td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{relativeTime(c.openedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-gray-400">
          <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
          <p>
            Integrity signals are collected automatically when students complete homework. High paste ratios or frequent focus-loss may indicate AI assistance or copying.
            Investigate pattern cases with the student and their form tutor before taking any action.
          </p>
        </div>

      </div>
    </AppShell>
  )
}
