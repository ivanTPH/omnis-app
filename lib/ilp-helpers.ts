/** Shared ILP AI helpers — plain lib file, importable from both server actions and route handlers. */

export function buildIlpPrompt(
  firstName: string,
  lastName:  string,
  yearGroup: number,
  sendCategory: string,
): string {
  const ksLabel = yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'KS4 (GCSE)' : 'KS5 (A-Level)'
  return `Generate a UK secondary school Individual Learning Plan for this student.

Student: ${firstName} ${lastName}
Year: Year ${yearGroup} (${ksLabel})
Support category: ${sendCategory}

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
