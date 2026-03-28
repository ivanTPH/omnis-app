import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getIlpEvidenceDashboard } from '@/app/actions/adaptive-learning'
import Icon from '@/components/ui/Icon'

export default async function IlpEvidencePage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { schoolId: string; role: string }
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) redirect('/dashboard')

  const data = await getIlpEvidenceDashboard(user.schoolId)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ILP Evidence Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Track homework evidence linked to Individual Learning Plan targets</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{data.studentsWithIlp}</div>
          <div className="text-xs text-gray-500 mt-1">Students with active ILP</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{data.targetsOnTrack}</div>
          <div className="text-xs text-green-700 mt-1">Targets on track / achieved</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{data.targetsBehind}</div>
          <div className="text-xs text-red-700 mt-1">Targets behind (due &lt;14d)</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-amber-700">{data.targetsWithNoEvidence}</div>
          <div className="text-xs text-amber-700 mt-1">Targets with no evidence</div>
        </div>
      </div>

      {/* Upcoming reviews */}
      {data.upcomingReviews.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Icon name="schedule" size="md" className="text-amber-600" />
            <h2 className="font-semibold text-gray-900">ILP Reviews Due in 30 Days</h2>
            <span className="ml-auto text-xs text-gray-400">{data.upcomingReviews.length} student{data.upcomingReviews.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.upcomingReviews.map(review => {
              const days = Math.ceil((new Date(review.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={review.studentId} className="px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <a
                          href={`/student/${review.studentId}/send`}
                          className="font-medium text-gray-900 hover:text-purple-700"
                        >
                          {review.studentName}
                        </a>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${days <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {days}d
                        </span>
                      </div>
                      {review.evidenceGaps.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500">Evidence gaps:</p>
                          {review.evidenceGaps.map((gap, i) => (
                            <p key={i} className="text-xs text-red-700 flex items-center gap-1">
                              <Icon name="warning" size="sm" />
                              {gap}{gap.length >= 60 ? '…' : ''}
                            </p>
                          ))}
                        </div>
                      )}
                      {review.evidenceGaps.length === 0 && (
                        <p className="text-xs text-green-700 flex items-center gap-1">
                          <Icon name="check_circle" size="sm" />
                          All targets have evidence
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(review.reviewDate).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.studentsWithIlp === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Icon name="description" size="lg" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active ILP plans found. Create ILP records from the ILP Records page.</p>
        </div>
      )}

      {data.targetsWithNoEvidence > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Icon name="warning" size="md" className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Action needed</p>
            <p className="text-xs text-amber-700 mt-1">
              {data.targetsWithNoEvidence} ILP target{data.targetsWithNoEvidence !== 1 ? 's have' : ' has'} no homework evidence linked.
              When setting homework, use the ILP target panel to link work to student targets.
              Evidence can also be added from the submission marking view.
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="bar_chart" size="sm" className="text-blue-600" />
          <p className="text-sm font-medium text-blue-800">How evidence is collected</p>
        </div>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Link homework to ILP targets when creating homework (Step 5 in HomeworkCreator)</li>
          <li>• Teachers can also link individual submissions to EHCP outcomes from the marking view</li>
          <li>• Evidence counts update automatically on the EHCP Plans page</li>
          <li>• AI progress reports can be generated from the student SEND record page</li>
        </ul>
      </div>
    </div>
  )
}
