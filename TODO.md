# Omnis App — Audit TODO

> Generated: 2026-04-20. Based on systematic code audit across 5 areas.
> Do not fix anything without reading the relevant section of CLAUDE.md first.

---

## 1. HOMEWORK SINGLE SOURCE OF TRUTH

Goal: all 4 entry points navigate to `/homework/[id]`.

| Entry Point | Status | File | Notes |
|---|---|---|---|
| A. Calendar → Lesson → Homework tab → click title | ✅ Works | `components/LessonFolder.tsx:1498` | `Link href="/homework/${hw.id}"` |
| B. Calendar → Lesson → Class tab → student → Homework tab → click | ❌ Broken | `components/ClassRosterTab.tsx:912` | Plain `<span>`, no link |
| C. My Classes → student row → Homework tab → click | ❌ Broken | `components/ClassRosterTab.tsx:912` | Same component, same bug |
| D. Sidebar Homework → click card | ✅ Works | `components/HomeworkFilterView.tsx:132` | Full card is a `Link` |

### TODO-HW-1 — Add `homeworkId` to `StudentClassDetail.recentSubmissions` · **Critical**

`getStudentClassDetail()` in `app/actions/lessons.ts` does not select
`homework { id }` in its Prisma query, so the returned `recentSubmissions`
array has no `id` field. Without it, `ClassRosterTab` cannot build the link.

**Fix:**
1. Add `id: string` to the `recentSubmissions` type in `StudentClassDetail`.
2. Update the Prisma select in `getStudentClassDetail()` to include
   `homework: { select: { id: true, title: true } }`.
3. In `ClassRosterTab.tsx:912`, replace the `<span>` with
   `<Link href={"/homework/" + s.homeworkId}>`.

Fixes entry points B and C simultaneously.

---

## 2. MY CLASSES FILTER CONSISTENCY

Comparison of filter controls on `/homework` vs `/classes`.

### Present on Homework, **missing** from My Classes

| Feature | Homework location | Priority |
|---|---|---|
| Status dropdown (Published / Draft / Needs Marking / Past) | `HomeworkFilterView.tsx:281` | Medium |
| Search field (by title / class name) | `HomeworkFilterView.tsx:303` | Medium |
| Active filter chips with individual clear + "Clear all" | `HomeworkFilterView.tsx:321` | Low |
| KPI cards (assignments, to-mark count, submission rate) | `HomeworkFilterView.tsx:344` | Low |

### Present on My Classes, absent from Homework

| Feature | Classes location | Notes |
|---|---|---|
| Pill-based class selection | `MyClassesView.tsx:87` | More discoverable than dropdown |
| Conditional filter visibility (hide if only 1 value) | `MyClassesView.tsx:59–62` | Better UX for small timetables |

### TODO-CLS-1 — Add search field to My Classes · **Medium**

`MyClassesView.tsx` has no way to search by class name or subject string.
Teachers with many classes must scroll to find the right one.
Add a text input that filters the class pill list by class name / subject.

### TODO-CLS-2 — Surface homework KPIs on My Classes page · **Medium**

The `/classes` page shows no summary metrics. Add a lightweight KPI strip
(total students, SEND count, pending homework to mark) using data already
available from the class roster query.

### TODO-CLS-3 — Add "Needs Marking" status filter to My Classes · **Low**

Teachers navigating from `/classes` cannot tell which classes have
ungraded submissions. Add a status chip or badge on class pills when
`submission.status = 'SUBMITTED'` count > 0.

---

## 3. REVISION DEPTH

| Check | Status | Evidence |
|---|---|---|
| a) Pull lesson topics for the class | ❌ Partial | Only most recent lesson fetched — `revision-program.ts:137–145` |
| b) Questions mapped to specific objectives | ✅ Pass | `content-generator.ts:78–98` — objectives → Bloom's mapping |
| c) Cover ALL lessons in topic | ❌ Fail | `findFirst` + `orderBy: desc` returns 1 lesson; others ignored |
| d) Mark scheme per question | ✅ Pass | `content-generator.ts:124–128`; shown in `RevisionTaskView.tsx:184` |
| e) Student gaps from homework history | ✅ Pass | `analysis-engine.ts:81–198` — per-topic weak/strong analysis |

### TODO-REV-1 — Fetch ALL lessons in period for revision generation · **High**

`createRevisionProgram()` (`revision-program.ts:137–145`) calls
`prisma.lesson.findFirst(orderBy: desc)` — this returns only the most
recently taught lesson. `analyseClassPerformance()` correctly fetches all
lessons (`analysis-engine.ts:61–65`) but the resulting topic list is stored
and **not passed to question generation**.

**Fix:**
1. Change `findFirst` → `findMany` in `createRevisionProgram()` to fetch all
   lessons in the period.
2. Pass the full `lessons[]` array (titles + objectives) into `generateRevisionTask()`.
3. In `content-generator.ts`, accept `lessons[]` alongside the existing
   `lessonTitle` / `objectives` params; build the AI prompt to cover all
   lessons, not just one.
4. Map each generated question to the lesson it covers
   (add `lessonIndex` field alongside existing `objectiveIndex`).

### TODO-REV-2 — Auto-select weak topics from analysis without manual step · **Medium**

Year revision (`createYearRevisionProgram()`) requires teachers to manually
select topics. The analysis already identifies `topicsNeedingRevision`
(weak < 60 %) and `topicsToSkip` (strong > 75 %). Pre-tick weak topics
in the year-revision UI so teachers only need to deselect, not build from
scratch.

---

## 4. SEND SCREENING AND ADAPTIVE CONTENT

| Check | Status | Evidence |
|---|---|---|
| a) SEND profile in AI homework prompt | ✅ Pass | `homework.ts:614–687` — full `sendContextBlock` passed to Claude |
| b) EHCP students see adapted questions | ✅ Pass | `HomeworkTypeRenderer.tsx:143–154` — `ehcp_adaptation` rendered |
| c) SEN Support students see scaffolding hints | ✅ Pass | `HomeworkTypeRenderer.tsx:178–183` — `scaffolding_hint` blue box |
| d) Teacher prompted to record ILP evidence after marking | ✅ Pass | `HomeworkMarkingView.tsx:471–475` — 10 s countdown banner |
| e) SENCO early warning at 3+ CONCERN entries | ✅ Pass | `senco/early-warning/page.tsx:27–52` — rose banner, links to ILP |
| f) Adaptive insights written back to ILP / EHCP / K Plan | ❌ Fail | `adaptive-learning.ts`, `ehcp.ts` — reports generated but nothing written back |

### TODO-SEND-1 — Write adaptive insights back to ILP/EHCP progress reports · **High**

`generateIlpProgressReport()` and `generateEhcpAnnualReview()`
(`ehcp.ts:405–570`) do not read `StudentLearningProfile`. The AI-generated
draft therefore omits the student's learning preferences, Bloom's
performance, classroom strategies, and concern level — the most actionable
data SENCO has.

**Fix:** Before calling Claude, fetch `StudentLearningProfile` for the
student and include `profileSummary`, `preferredTypes`, `strengthAreas`,
`developmentAreas`, `sendConcernLevel`, and `classroomStrategies` in the
system prompt context.

### TODO-SEND-2 — Auto-transition `IlpTarget.status` from evidence entries · **High**

`saveIlpEvidenceEntries()` (`homework.ts:1472–1551`) creates
`IlpEvidenceEntry` records but never touches `IlpTarget.status`. Targets
remain `"active"` indefinitely even after multiple PROGRESS or CONCERN
entries. SENCO must update manually.

**Fix:** After bulk-creating evidence entries, count PROGRESS / CONCERN
entries per target this term. If a target accumulates ≥ 3 PROGRESS entries,
flag it for SENCO review as a candidate for `"achieved"`. If ≥ 3 CONCERN,
flag for `"deferred"` review. Do not auto-set status — surface as a
suggested action in the SENCO ILP detail page.

### TODO-SEND-3 — Include `IlpEvidenceEntry` data in `updateLearningProfile()` · **Medium**

`updateLearningProfile()` (`adaptive-learning.ts:103–312`) computes
`sendConcernLevel` from submission `sendRiskScore` only. It never reads
`IlpEvidenceEntry`. A student with 5 CONCERN entries this term can still
show `sendConcernLevel: 'low'` in their profile if their submission scores
are acceptable.

**Fix:** In `updateLearningProfile()`, count CONCERN entries this term
from `IlpEvidenceEntry` and factor into `sendConcernLevel` calculation.

---

## 5. PLANS REFLECTING ADAPTIVE LEARNING

Current state: adaptive learning and SEND plans operate as parallel systems
with one-way data flows and no feedback loops.

### What currently works (one-way reads)

| Flow | Trigger | Location |
|---|---|---|
| Homework submission → `StudentLearningProfile` | `markSubmission()` fire-and-forget | `homework.ts:1216` |
| IlpEvidenceEntry CONCERN count → SENCO notification | `saveIlpEvidenceEntries()` | `homework.ts:1511–1548` |
| SEND status + ILP targets → adaptive homework suggestions | `getAdaptiveHomeworkSuggestions()` | `adaptive-learning.ts:469` |
| `StudentLearningProfile.predictedGrade` → analytics/RAG | read-only | `analytics.ts`, `rag.ts` |

### What is missing (no connection exists)

### TODO-PLAN-1 — Trigger `updateLearningProfile()` from early-warning cron · **High**

The 6 am early-warning cron (`api/cron/early-warning/route.ts`) detects
homework completion drops and score declines and creates `EarlyWarningFlag`
records, but never calls `updateLearningProfile()`. The student's
`sendConcernLevel` in `StudentLearningProfile` therefore does not reflect
the flag.

**Fix:** After `analyseStudentPatterns()` creates a flag for a student,
call `updateLearningProfile(studentId)` so the profile's `sendConcernLevel`
is recalculated immediately.

### TODO-PLAN-2 — Pass `StudentLearningProfile` context to revision task generation · **Medium**

`generateRevisionTask()` (`lib/revision/content-generator.ts:59–158`)
receives SEND adaptations and ILP targets but ignores the student's
`preferredTypes`, `bloomsPerformance`, and `classroomStrategies`. Revision
tasks are therefore generic rather than adapted to how the student learns.

**Fix:** Accept `learningProfile: Pick<StudentLearningProfile, 'preferredTypes' | 'bloomsPerformance' | 'classroomStrategies'>` as an optional param; include it in the Claude prompt's differentiation section.

### TODO-PLAN-3 — Bidirectional sync: K Plan `classroomStrategies` ↔ ILP target strategy · **Medium**

K Plan (`classroomStrategies` in `StudentLearningProfile`) and ILP target
strategies (`IlpTarget.strategy`) are maintained independently. Changes to
one are never reflected in the other. SENCO editing an ILP strategy and a
teacher approving a K Plan can produce contradictory guidance.

**Fix (lightweight):** When SENCO saves an ILP target strategy change
(`send-support.ts`), append the new strategy to
`StudentLearningProfile.classroomStrategies` (deduplicated). When a K Plan
is approved (`students.ts:approveLearningPassport`), surface new strategies
as suggested additions to any active ILP target (notification, not auto-write).

### TODO-PLAN-4 — Surface `StudentLearningProfile` summary in SENCO ILP view · **Low**

SENCO reviewing `/send/ilp/[studentId]` cannot see the student's adaptive
profile (preferred homework types, Bloom's performance, concern level trend).
This data exists in `StudentLearningProfile` but is not displayed in any
SEND-facing UI.

**Fix:** Add a collapsible "Adaptive Profile" card to the ILP detail page
that shows `profileSummary`, `preferredTypes`, `sendConcernLevel`, and
`classroomStrategies`.

---

## Priority Summary

| ID | Area | Priority | Effort |
|---|---|---|---|
| TODO-HW-1 | Add `homeworkId` to roster submissions → fix entry points B & C | **Critical** | Small |
| TODO-SEND-1 | Pass `StudentLearningProfile` to ILP/EHCP report generation | **High** | Small |
| TODO-SEND-2 | Surface ILP target status suggestions from evidence count | **High** | Medium |
| TODO-PLAN-1 | Call `updateLearningProfile()` from early-warning cron | **High** | Small |
| TODO-REV-1 | Fetch all lessons in period for revision, not just most recent | **High** | Medium |
| TODO-SEND-3 | Include `IlpEvidenceEntry` in `sendConcernLevel` calculation | **Medium** | Small |
| TODO-CLS-1 | Add search field to My Classes | **Medium** | Small |
| TODO-CLS-2 | Surface homework KPIs on My Classes page | **Medium** | Medium |
| TODO-REV-2 | Pre-tick weak topics in year-revision UI | **Medium** | Small |
| TODO-PLAN-2 | Pass learning profile to revision task generation | **Medium** | Small |
| TODO-PLAN-3 | K Plan ↔ ILP strategy bidirectional sync | **Medium** | Medium |
| TODO-CLS-3 | "Needs Marking" badge on class pills | **Low** | Small |
| TODO-CLS-4 | Filter chips + Clear all on My Classes | **Low** | Small |
| TODO-PLAN-4 | Adaptive profile card in SENCO ILP view | **Low** | Medium |
