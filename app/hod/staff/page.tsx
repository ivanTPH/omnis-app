import { requireAuth }          from '@/lib/session'
import { redirect }             from 'next/navigation'
import Link                     from 'next/link'
import AppShell                 from '@/components/AppShell'
import Icon                     from '@/components/ui/Icon'
import { PageHeader }           from '@/components/ui/PageHeader'
import { getHodDashboardData }  from '@/app/actions/hod'
import { formatAvgGrade }       from '@/lib/gradeUtils'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

function RagDot({ rag }: { rag: 'green' | 'amber' | 'red' | null }) {
  if (!rag) return <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
  const cls = rag === 'green' ? 'bg-emerald-500' : rag === 'amber' ? 'bg-amber-400' : 'bg-rose-500'
  return <span className={`w-2.5 h-2.5 rounded-full ${cls} inline-block`} />
}

function GradePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-[12px]">—</span>
  const { main } = formatAvgGrade(score)
  const colour = score >= 5.5
    ? 'bg-emerald-100 text-emerald-700'
    : score >= 4
    ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${colour}`}>
      {main}
    </span>
  )
}

export default async function HodStaffPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const data = await getHodDashboardData()

  // Build per-teacher → classes lookup using teacherIds
  const staffWithClasses = data.staff.map(s => ({
    ...s,
    classes: data.classes.filter(c => c.teacherIds.includes(s.id)),
  }))

  const totalUngraded = data.staff.reduce((sum, s) => sum + s.ungradedCount, 0)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <PageHeader
            title="Staff Overview"
            subtitle={`${data.department} · ${data.staff.length} staff member${data.staff.length !== 1 ? 's' : ''}`}
            backHref="/hod/dashboard"
            backLabel="HOD Dashboard"
          />

          {/* Summary bar */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Staff</p>
              <p className="text-2xl font-bold text-gray-900">{data.staff.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Classes</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalClasses}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Students</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalStudents}</p>
            </div>
            <div className={`border rounded-xl px-4 py-3 ${totalUngraded > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Ungraded</p>
              <p className={`text-2xl font-bold ${totalUngraded > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {totalUngraded}
              </p>
            </div>
          </div>

          {data.staff.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 text-center">
              <Icon name="groups" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No staff found in this department.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {staffWithClasses.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Teacher header */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
                    {/* Avatar initials */}
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[13px] font-bold shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-[11px] text-gray-400">Classes</p>
                        <p className="text-[16px] font-bold text-gray-900">{s.classCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-gray-400">Students</p>
                        <p className="text-[16px] font-bold text-gray-900">{s.studentCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-gray-400">Avg grade</p>
                        <GradePill score={s.avgScore} />
                      </div>
                      {s.ungradedCount > 0 && (
                        <div className="text-center">
                          <p className="text-[11px] text-gray-400">Ungraded</p>
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Icon name="pending_actions" size="sm" />
                            {s.ungradedCount}
                          </span>
                        </div>
                      )}
                      <a
                        href={`mailto:${s.email}`}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 transition-colors shrink-0"
                      >
                        <Icon name="mail" size="sm" />
                        Email
                      </a>
                    </div>
                  </div>

                  {/* Classes table */}
                  {s.classes.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {s.classes.map(cls => (
                        <div key={cls.id} className="flex items-center gap-4 px-5 py-2.5 text-[12px] hover:bg-gray-50 transition-colors">
                          <RagDot rag={cls.rag} />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900">{cls.name}</span>
                            <span className="text-gray-400 ml-2">{cls.subject}</span>
                          </div>
                          <span className="text-gray-400 shrink-0">Y{cls.yearGroup}</span>
                          <span className="text-gray-500 shrink-0">{cls.studentCount} students</span>
                          {cls.sendCount > 0 && (
                            <span className="text-amber-600 shrink-0 flex items-center gap-0.5">
                              <Icon name="accessibility_new" size="sm" />
                              {cls.sendCount} SEND
                            </span>
                          )}
                          <GradePill score={cls.avgScore} />
                          {cls.completionRate != null && (
                            <span className="text-gray-400 shrink-0">
                              {Math.round(cls.completionRate * 100)}% completion
                            </span>
                          )}
                          {cls.ungradedCount > 0 && (
                            <span className="text-amber-600 text-[11px] shrink-0">
                              {cls.ungradedCount} ungraded
                            </span>
                          )}
                          <Link
                            href={`/analytics?classId=${cls.id}`}
                            className="text-[11px] text-blue-600 hover:underline shrink-0"
                          >
                            View →
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-5 py-3 text-[12px] text-gray-400">No classes assigned in this department.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-6 text-[11px] text-gray-400">
            Grades on 1–9 GCSE scale · RAG: green ≥5.5 · amber ≥4 · red &lt;4
          </p>

        </div>
      </main>
    </AppShell>
  )
}
