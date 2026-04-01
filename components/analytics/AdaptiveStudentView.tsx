'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { getStudentTopicBreakdown } from '@/app/actions/analytics'
import { generateResource } from '@/app/actions/ai-generator'
import type { StudentTopicBreakdown } from '@/app/actions/analytics'
import StudentAvatar from '@/components/StudentAvatar'

type Props = {
  studentId: string
  classId:   string
}

type GenState = { id: string; title: string } | 'generating' | 'error' | null

export default function AdaptiveStudentView({ studentId, classId }: Props) {
  const [data, setData]       = useState<StudentTopicBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [genMap, setGenMap]   = useState<Record<string, GenState>>({})

  useEffect(() => {
    getStudentTopicBreakdown(studentId, classId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [studentId, classId])

  async function handleGenerate(topic: string) {
    if (!data) return
    setGenMap(prev => ({ ...prev, [topic]: 'generating' }))
    try {
      const result = await generateResource({
        schoolId:        '',
        subject:         data.subject,
        yearGroup:       `Year ${data.yearGroup}`,
        topic,
        resourceType:    'worksheet',
        sendAdaptations: [],
        additionalNotes: `Targeted revision for ${data.firstName} ${data.lastName}. Focus on addressing gaps in this topic.`,
      })
      setGenMap(prev => ({ ...prev, [topic]: { id: result.id, title: result.title } }))
    } catch {
      setGenMap(prev => ({ ...prev, [topic]: 'error' }))
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-10 text-gray-400">
      <Icon name="refresh" size="sm" className="animate-spin" />
      <span className="text-sm">Loading student data…</span>
    </div>
  )
  if (error)  return <p className="text-sm text-red-600">{error}</p>
  if (!data)  return null

  const redCount = data.topics.filter(t => t.myStatus === 'red').length

  return (
    <div className="space-y-5">
      {/* Student header card */}
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
        <StudentAvatar
          firstName={data.firstName}
          lastName={data.lastName}
          avatarUrl={null}
          sendStatus={data.hasSend ? (data.sendCategory as any) : null}
          size="md"
          userId={data.studentId}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900">{data.firstName} {data.lastName}</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">{data.subject} · Year {data.yearGroup}</p>
          {data.hasSend && (
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              data.sendCategory === 'EHCP'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {data.sendCategory === 'EHCP' ? 'EHCP' : 'SEN Support'}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {data.predictedGradeBaseline ? (
            <>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Predicted baseline</div>
              <div className="text-[22px] font-bold text-gray-900">{data.predictedGradeBaseline}</div>
            </>
          ) : (
            <div className="text-[11px] text-gray-400">No grade data</div>
          )}
        </div>
      </div>

      {/* Red topics alert */}
      {redCount > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-800">
          <Icon name="error" size="sm" className="text-red-500 flex-shrink-0" />
          <span>
            <strong>{redCount} topic{redCount !== 1 ? 's' : ''}</strong> significantly below expected. Use &apos;Generate Revision&apos; to create targeted practice.
          </span>
        </div>
      )}

      {/* Topic breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-gray-900">Topic Performance</h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥70%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 50–69%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;50%</span>
          </div>
        </div>

        {data.topics.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            No marked homework found for this student in the last term.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.topics.map(t => {
              const gen = genMap[t.topic]
              return (
                <div key={t.topic} className="flex items-center gap-3 px-4 py-3">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    t.myStatus === 'green'   ? 'bg-green-500' :
                    t.myStatus === 'amber'   ? 'bg-amber-400' :
                    t.myStatus === 'red'     ? 'bg-red-500' :
                    'bg-gray-200'
                  }`} />

                  {/* Topic + scores */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-800 truncate font-medium">{t.topic}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {t.myScore != null
                        ? `My score: ${t.myScore}%`
                        : <span className="italic">Not submitted</span>}
                      {' · '}
                      Class avg: {t.classAvgScore}%
                    </p>
                  </div>

                  {/* Mini score bar */}
                  <div className="w-20 flex-shrink-0">
                    {t.myScore != null && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            t.myStatus === 'green' ? 'bg-green-500' :
                            t.myStatus === 'amber' ? 'bg-amber-400' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${t.myScore}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Generate button — only for red topics */}
                  {t.myStatus === 'red' && (
                    <div className="flex-shrink-0 w-44 text-right">
                      {gen == null && (
                        <button
                          onClick={() => handleGenerate(t.topic)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold transition-colors border border-red-200"
                        >
                          <Icon name="auto_fix_high" size="sm" />
                          Generate Revision
                        </button>
                      )}
                      {gen === 'generating' && (
                        <span className="inline-flex items-center gap-1.5 text-gray-400 text-[11px]">
                          <Icon name="refresh" size="sm" className="animate-spin" />
                          Generating…
                        </span>
                      )}
                      {gen === 'error' && (
                        <button
                          onClick={() => handleGenerate(t.topic)}
                          className="text-[11px] text-red-500 hover:text-red-700"
                        >
                          Failed — retry
                        </button>
                      )}
                      {gen != null && gen !== 'generating' && gen !== 'error' && (
                        <a
                          href="/ai-generator"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold border border-green-200 hover:bg-green-100 transition-colors"
                        >
                          <Icon name="check" size="sm" />
                          {(gen as { id: string; title: string }).title.length > 22 ? (gen as { id: string; title: string }).title.slice(0, 22) + '…' : (gen as { id: string; title: string }).title}
                          <Icon name="arrow_forward" size="sm" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
