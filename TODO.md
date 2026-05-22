# Omnis App — Audit TODO

> Last updated: 2026-05-22 (session 2). All items verified against codebase — status reflects actual code, not assumptions.
> Do not fix anything without reading the relevant section of CLAUDE.md first.

---

## Status Key
✅ Done — verified in code  |  ❌ Outstanding  |  ⚠️ Partial

---

## 1. HOMEWORK SINGLE SOURCE OF TRUTH

Goal: all 4 entry points navigate to `/homework/[id]`.

| Entry Point | Status | Notes |
|---|---|---|
| A. Calendar → Lesson → Homework tab → click title | ✅ | `LessonFolder.tsx` — `Link href="/homework/${hw.id}"` |
| B. Calendar → Lesson → Class tab → student → Homework tab | ✅ | `ClassRosterTab.tsx` — `Link` + `homeworkId` both confirmed |
| C. My Classes → student row → Homework tab → click | ✅ | Same component, same fix |
| D. Sidebar Homework → click card | ✅ | `HomeworkFilterView.tsx` — full card is a `Link` |

### TODO-HW-1 ✅ COMPLETE
`homeworkId` is selected, returned in `StudentClassDetail`, and rendered as `<Link>` in ClassRosterTab.
No action needed.

---

## 2. MY CLASSES FILTER CONSISTENCY

| Feature | Status | Notes |
|---|---|---|
| Search field (by student name) | ✅ | `MyClassesView.tsx` — `search` state + filtered roster |
| Status dropdown | ❌ | Not on `/classes` — homework filter only |
| Filter chips + Clear all | ❌ | Low priority |
| KPI cards (students, SEND, to-mark) | ❌ | Medium priority — data available but not shown |
| "Needs Marking" badge on class pills | ❌ | Low priority |

### TODO-CLS-1 ✅ COMPLETE — search field exists in MyClassesView
### TODO-CLS-2 ✅ COMPLETE — KPI strip added (commit f9cff95)
### TODO-CLS-3 ❌ OUTSTANDING — "Needs Marking" badge on class pills
### TODO-CLS-4 ✅ COMPLETE — filter chips + Clear all already in MyClassesView.tsx

---

## 3. REVISION DEPTH

| Check | Status | Notes |
|---|---|---|
| Pull ALL lesson topics for period | ✅ | `revision-program.ts:137` — `findMany` + date range + fallback |
| Questions mapped to objectives | ✅ | `content-generator.ts` — objectives → Bloom's mapping |
| Cover ALL lessons | ✅ | `findMany` with `periodStart`/`periodEnd`, not `findFirst` |
| Mark scheme per question | ✅ | `content-generator.ts` + rendered in `RevisionTaskView` |
| Student gaps from homework history | ✅ | `analysis-engine.ts` — per-topic weak/strong analysis |
| Auto-select weak topics in year revision | ❌ | `TODO-REV-2` — teachers must manually tick all topics |

### TODO-REV-1 ✅ COMPLETE — `findMany` fetches all lessons in period
### TODO-REV-2 ✅ COMPLETE — weak topics pre-ticked, badges shown, amber banner (prev session)

---

## 4. SEND SCREENING AND ADAPTIVE CONTENT

| Check | Status | Notes |
|---|---|---|
| SEND profile in AI homework prompt | ✅ | `homework.ts` — full `sendContextBlock` passed to Claude |
| EHCP students see adapted questions | ✅ | `HomeworkTypeRenderer` — `ehcp_adaptation` rendered |
| SEN Support students see scaffolding hints | ✅ | `HomeworkTypeRenderer` — `scaffolding_hint` blue box |
| Teacher prompted to record ILP evidence after marking | ✅ | `HomeworkMarkingView` — 10s countdown banner |
| SENCO early warning at 3+ CONCERN entries | ✅ | `senco/early-warning` — rose banner, EarlyWarningFlag |
| IlpTarget auto-transitions to `achieved` on 3+ PROGRESS | ✅ | `saveIlpEvidenceEntries` — commit 5bfdc41 |
| Adaptive insights in ILP/EHCP progress reports | ✅ | `ehcp.ts` — `StudentLearningProfile` fetched and included in AI prompt |
| `IlpEvidenceEntry` CONCERN count in `sendConcernLevel` | ✅ | Blended 50/50 in `lib/adaptive-profile.ts` (prev session) |

### TODO-SEND-1 ✅ COMPLETE — learningProfile included in both generateIlpProgressReport and generateEhcpAnnualReview
### TODO-SEND-2 ✅ COMPLETE — auto-transition to achieved + audit entry + SENCO notification (commit 5bfdc41)
### TODO-SEND-3 ✅ COMPLETE — blended 50/50 in `lib/adaptive-profile.ts` (prev session)

---

## 5. PLANS REFLECTING ADAPTIVE LEARNING

| Flow | Status | Notes |
|---|---|---|
| Homework submission → `StudentLearningProfile` | ✅ | `markSubmission` fire-and-forget |
| IlpEvidenceEntry CONCERN → SENCO notification | ✅ | `saveIlpEvidenceEntries` |
| IlpEvidenceEntry PROGRESS → target `achieved` | ✅ | `saveIlpEvidenceEntries` — commit 5bfdc41 |
| SEND status + ILP → adaptive homework suggestions | ✅ | `getAdaptiveHomeworkSuggestions` |
| Early-warning cron → `computeAndSaveAdaptiveProfile` | ✅ | `early-warning/route.ts` — commit f5263df |
| `StudentLearningProfile` → ILP/EHCP reports | ✅ | `ehcp.ts` — profileSummary, preferredTypes, etc. in prompt |
| `preferredTypes` → revision task generation | ✅ | `content-generator.ts` — `preferredTypes` used in prompt |
| Adaptive profile card in SENCO ILP view | ✅ | `IlpEvidenceView` — `profileSummary` displayed |
| K Plan ↔ ILP strategy bidirectional sync | ❌ | TODO-PLAN-3 — still two independent systems |

### TODO-PLAN-1 ✅ COMPLETE — cron refreshes all active students' profiles (commit f5263df)
### TODO-PLAN-2 ✅ COMPLETE — `preferredTypes` passed to `generateRevisionTask`
### TODO-PLAN-3 ❌ OUTSTANDING — K Plan strategies and ILP target strategies not synced
### TODO-PLAN-4 ✅ COMPLETE — `profileSummary` shown in IlpEvidenceView

---

## 6. HARDENING & DESIGN POLISH (May 2026)

| Item | Status | Notes |
|---|---|---|
| `app/calendar/error.tsx` missing | ✅ | Added — commit (this session) |
| Bare `<a href>` in early-warning/page.tsx | ✅ | Changed to `<Link>` — commit (this session) |
| Bare `<a href>` in ClassRosterTab.tsx | ✅ | Changed to `<Link>` — commit (this session) |
| `SencoRow` header div missing `role`/`tabIndex`/keyboard handler | ✅ | Fixed — commit (this session) |
| `StudentAnalyticsView` homework row missing accessibility | ✅ | Fixed — commit (this session) |
| AI endpoints rate-limited | ✅ | generate-homework: 10/day; generate-ilp: 20/day |
| All API routes auth-checked | ✅ | Only `[...nextauth]` is public (correct) |
| `revalidateTag` second arg `'default'` | ✅ | Fixed in P2 audit (commit 55c12bd) |
| Login rate limiting (Upstash) | ⚠️ | No-op without env vars — skipped intentionally |

---

## Priority Summary — Outstanding Items

| ID | Area | Priority | Effort |
|---|---|---|---|
| TODO-PLAN-3 | K Plan ↔ ILP strategy bidirectional sync | Medium | Medium |
| TODO-CLS-3 | "Needs Marking" badge on class pills | Low | Small |
