/** Shared ILP AI helpers — plain lib file, importable from both server actions and route handlers. */

export type IlpCohortContext = {
  studentCount:       number
  sendCount:          number
  avgCompletionRate:  number
  avgScore:           number
  bloomsPerformance:  Record<string, number>
  sendTypePerformance: Record<string, { avg: number; count: number }>
  needAreaBreakdown:  Record<string, number>
  trendCounts:        { improving: number; stable: number; declining: number }
  topStrategies:      string[]
}

function buildCohortSection(cohort: IlpCohortContext, yearGroup: number): string {
  const totalSend   = cohort.sendCount
  const totalAll    = cohort.studentCount
  const sendPct     = totalAll > 0 ? Math.round((totalSend / totalAll) * 100) : 0
  const completion  = Math.round(cohort.avgCompletionRate * 100)

  // Best homework type for SEND students in this cohort
  const bestSendType = Object.entries(cohort.sendTypePerformance)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 2)
    .map(([t, d]) => `${t.replace('_', ' ')} (avg ${d.avg}%)`)
    .join(', ')

  // Strongest Bloom's level in this cohort
  const bestBlooms = Object.entries(cohort.bloomsPerformance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([level, score]) => `${level} (${score}%)`)
    .join(', ')

  const trendStr = `${cohort.trendCounts.improving} improving / ${cohort.trendCounts.stable} stable / ${cohort.trendCounts.declining} declining`

  const needAreaStr = Object.entries(cohort.needAreaBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([area, n]) => `${area} (${n})`)
    .join(', ')

  const strategies = cohort.topStrategies.slice(0, 3).join('; ')

  return `
SCHOOL COHORT CONTEXT (Year ${yearGroup} — use this to ground your ILP in real patterns, not generic advice):
- ${totalSend} of ${totalAll} students (${sendPct}%) are SEND-registered in this year group
- Average homework completion rate: ${completion}%
- Average score across cohort: ${cohort.avgScore}%
- Student trend distribution: ${trendStr}
- Strongest Bloom's levels for this cohort: ${bestBlooms || 'insufficient data'}
- Best-performing homework types for SEND students: ${bestSendType || 'insufficient data'}
- Most common SEND need areas: ${needAreaStr || 'none recorded'}
- Most effective ILP strategies used in school: ${strategies || 'none recorded yet'}

Use this cohort data to:
1. Set targets that are ambitious but realistic for this school's Year ${yearGroup} context
2. Recommend the homework/task types that data shows work best for SEND students here
3. Align strategies with those already proven effective in this school`
}

export function buildIlpPrompt(
  firstName:    string,
  lastName:     string,
  yearGroup:    number,
  sendCategory: string,
  cohort?:      IlpCohortContext,
): string {
  const ksLabel = yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'KS4 (GCSE)' : 'KS5 (A-Level)'
  const cohortSection = cohort ? buildCohortSection(cohort, yearGroup) : ''

  return `Generate a UK secondary school Individual Learning Plan for this student.

Student: ${firstName} ${lastName}
Year: Year ${yearGroup} (${ksLabel})
Support category: ${sendCategory}
${cohortSection}
Return ONLY valid JSON (no markdown):
{
  "likes": "2 sentences describing what Year ${yearGroup} students typically enjoy at school",
  "dislikes": "2 sentences describing common learning challenges for Year ${yearGroup} students",
  "currentStrengths": "2-3 sentences: expected academic strengths at ${ksLabel} level",
  "areasOfNeed": "2-3 sentences: priority development areas based on ${ksLabel} National Curriculum",
  "targets": [
    {"target": "SMART literacy target for Year ${yearGroup}", "strategy": "specific classroom strategy", "successMeasure": "measurable outcome", "targetDateWeeks": 12},
    {"target": "SMART numeracy target for Year ${yearGroup}", "strategy": "specific classroom strategy", "successMeasure": "measurable outcome", "targetDateWeeks": 12},
    {"target": "SMART study-skills/metacognition target", "strategy": "specific classroom strategy", "successMeasure": "measurable outcome", "targetDateWeeks": 12}
  ],
  "strategies": ["strategy 1", "strategy 2", "strategy 3", "strategy 4", "strategy 5"],
  "resourcesNeeded": ["resource 1", "resource 2", "resource 3"],
  "successCriteria": "Overall ILP success measure for the term"
}`
}
