'use client'

/**
 * components/students/AiJourneyTab.tsx
 *
 * The "how has AI been involved in this child's support" surface from
 * dspy-service/XAI.md's "student-journey explanation" section — summary
 * counts, review-outcome breakdown, consent status, and a chronological
 * timeline of every AgentAuditEntry for this student, each rendered via
 * AiDecisionExplanation. This is the artefact a DSAR response, an
 * Ofsted/SEND inspection request, or a parent meeting can be built from
 * directly — a full accounting, not a sample.
 */

import { useState } from 'react'
import type { AiJourneySummary } from '@/app/actions/agent-insights'
import AiDecisionExplanation from './AiDecisionExplanation'

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

export default function AiJourneyTab({
  data,
  loading,
}: {
  studentId: string
  data: AiJourneySummary | null
  loading: boolean
}) {
  const [skillFilter, setSkillFilter] = useState<string | null>(null)

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading AI journey…</div>
  }
  if (!data) {
    return <div className="text-sm text-gray-400 py-8 text-center">Nothing to show yet.</div>
  }

  const filteredEntries = skillFilter
    ? data.entries.filter(e => `${e.agentType}::${e.skillId}` === skillFilter)
    : data.entries

  return (
    <div className="space-y-4">
      <SectionCard title="Consent for AI-assisted decision support">
        {data.consent.purposeActive ? (
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
              &ldquo;{data.consent.purposeTitle}&rdquo; is active for this school
              {data.consent.lawfulBasis && <> (lawful basis: {data.consent.lawfulBasis.replace(/_/g, ' ')})</>}.
            </p>
            <p className="text-xs text-gray-500">
              {data.consent.studentRecordExists
                ? `A specific consent record exists for this student (${data.consent.studentRecordDecision}).`
                : 'No student-specific consent record exists — this school is relying on its school-level lawful basis rather than per-pupil consent for this purpose.'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            No active &ldquo;AI-assisted decision support&rdquo; consent purpose found for this school.
          </p>
        )}
      </SectionCard>

      <SectionCard title={`Summary — ${data.totalEntries} AI-assisted touchpoint${data.totalEntries === 1 ? '' : 's'}`}>
        {data.totalEntries === 0 ? (
          <p className="text-sm text-gray-500">No AI agent has produced a suggestion for this student yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSkillFilter(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  skillFilter === null ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                All ({data.totalEntries})
              </button>
              {data.byAgentSkill.map(s => {
                const key = `${s.agentType}::${s.skillId}`
                return (
                  <button
                    key={key}
                    onClick={() => setSkillFilter(key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      skillFilter === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s.agentLabel} · {s.skillLabel} ({s.count})
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-emerald-50 rounded-lg py-3">
                <div className="text-lg font-semibold text-emerald-700">{data.reviewOutcomeCounts.confirmed}</div>
                <div className="text-xs text-emerald-700">Confirmed</div>
              </div>
              <div className="bg-amber-50 rounded-lg py-3">
                <div className="text-lg font-semibold text-amber-700">{data.reviewOutcomeCounts.overridden}</div>
                <div className="text-xs text-amber-700">Edited</div>
              </div>
              <div className="bg-gray-100 rounded-lg py-3">
                <div className="text-lg font-semibold text-gray-600">{data.reviewOutcomeCounts.dismissed}</div>
                <div className="text-xs text-gray-600">Dismissed</div>
              </div>
              <div className="bg-red-50 rounded-lg py-3">
                <div className="text-lg font-semibold text-red-700">{data.reviewOutcomeCounts.unreviewed}</div>
                <div className="text-xs text-red-700">Awaiting review</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {filteredEntries.length > 0 && (
        <SectionCard title="Timeline">
          <div className="space-y-3">
            {filteredEntries.map(entry => (
              <AiDecisionExplanation key={entry.id} entry={entry} />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
