# Phase 8.3 — Retention & deletion in practice (2026-08-30)

## STATUS: workflow exists, runs correctly for a defined subset of models, and correctly respects schoolId scoping — but a substantial number of active, PII-bearing models are neither deleted nor documented as intentionally retained. Not a "doesn't exist" finding — a coverage-gap finding.

## 1. Where the workflow lives

The DPIA's "leaver deletion workflow" is **`executeErasure(dsrId)`** in `app/actions/gdpr.ts:511`, reachable from `/admin/gdpr` → "Data Subject Requests" tab → **manually**, not automatically:

1. SCHOOL_ADMIN or SLT logs a Data Subject Request (`submitDataSubjectRequest`) of type `erasure` against a specific student, via `NewDsrModal`.
2. SCHOOL_ADMIN opens the request row and clicks **Execute** (`DataSubjectRequestList.tsx`), which opens `ErasureConfirmModal` — a confirmation screen listing what will be deleted vs. retained, gated behind typing the literal word `CONFIRM`.
3. `executeErasure()` runs, `SCHOOL_ADMIN`-only (checked in code, not just UI), inside a single `$transaction` with a 30s timeout.

**This is not tied to any "leaver" flag.** There is no automatic trigger — not from the year-rollover cron (`app/api/cron/year-rollover/route.ts`, which only sets Y13 students `isActive=false`, never deletes anything), not from any other event. It is a fully manual admin action, and it only exists for **students** — `getStudentsForDsr()` is scoped to `role: 'STUDENT'`; there is no equivalent staff-erasure workflow. Both of these are worth recording precisely since the task brief speculated it might be leaver-flag-triggered or cover staff too — it does neither.

## 2. Test method

Rather than read the code and assume it works, a synthetic "leaver" was built with realistic linked data across **every model in the schema that carries a `studentId`/`childId` foreign key** (30 categories, cross-checked against `prisma/schema.prisma` with a script, not guessed), created via direct Prisma calls against the same Supabase database the running app uses — then the erasure was triggered through the **actual product UI** (Playwright driving a real login as `admin@omnisdemo.school`, real clicks through `/admin/gdpr`), not by calling the server action directly. Counts were taken by direct SQL/Prisma query before and after, not by re-reading the UI.

A **control record** (a real, pre-existing student, "Joseph Walker," at a second school — Oakfield Academy) was given a `SafeguardingRecord` and a `BehaviourRecord` stamped `"CONTROL RECORD — must survive"` before the test, specifically to catch any cross-tenant leakage.

Screenshots of the full UI flow are in `evidence/retention-test-screenshots/` (`01`–`07`, in order: GDPR page → DSR tab → new-request modal → form filled → request logged → execute button → confirm modal with the product's own deleted/retained lists visible → typed `CONFIRM` → executed).

All test data (including the anonymised leftover row and the control records) was deleted after the test completed — the demo school and Oakfield Academy are both back to their pre-test state. This document is the durable record.

## 3. Result — full before/after count, every category

| Category | Before | After | Outcome |
|---|---|---|---|
| **User row itself** | 1 | 1 | Retained, PII anonymised (see §4) |
| UserSettings | 1 | 0 | **Deleted** |
| UserAccessibilitySettings | 1 | 0 | **Deleted** |
| Enrolment | 1 | 0 | **Deleted** |
| Submission (homework answers) | 1 | 0 | **Deleted** |
| IlpEvidenceEntry | 1 | 0 | **Deleted** |
| KPlan | 1 | 0 | **Deleted** |
| LearnerPassport | 1 | 0 | **Deleted** |
| TaNote | 1 | 0 | **Deleted** |
| ParentContactEntry | 1 | 0 | **Deleted** |
| StudentQuickNote | 1 | 0 | **Deleted** |
| SendConcern | 1 | 0 | **Deleted** |
| EarlyWarningFlag | 1 | 0 | **Deleted** |
| RevisionExam | 1 | 0 | **Deleted** |
| RevisionSession | 1 | 0 | **Deleted** |
| RevisionConfidence | 1 | 0 | **Deleted** |
| StudentBaseline | 1 | 0 | **Deleted** |
| StudentLearningProfile | 1 | 0 | **Deleted** |
| AgentSnapshot | 1 | 0 | **Deleted** |
| ParentStudentLink | 1 | 0 | **Deleted** |
| ParentChildLink | 1 | 0 | **Deleted** |
| MsgParticipant (student's own) | 1 | 0 | **Deleted** |
| MsgMessage (sent by student) | 1 | 0 | **Deleted** |
| ConsentRecord | 1 | 0 | **Deleted** |
| PasswordResetToken | 1 | 0 | **Deleted** |
| Notification | 1 | 0 | **Deleted** |
| SendNotification | 1 | 0 | **Deleted** |
| IndividualLearningPlan | 1 | 1 | Retained — **documented** (§4) |
| IlpTarget | 1 | 1 | Retained — **documented** (cascades with ILP) |
| EhcpPlan | 1 | 1 | Retained — **documented** (§4) |
| AssessPlanDoReview (APDR) | 1 | 1 | Retained — **documented** (§4) |
| SendStatus | 1 | 1 | Retained — **documented** (§4) |
| legacy `Plan` + `PlanTarget` | 1 / 1 | 1 / 1 | Retained — **undocumented** (§5) |
| legacy `ILP` + `ILPTarget` + `ILPNote` | 1/1/1 | 1/1/1 | Retained — **undocumented** (§5) |
| SendReviewLog | 1 | 1 | Retained — **undocumented** (§5) |
| SendStatusReview | 1 | 1 | Retained — **undocumented** (§5) |
| **SafeguardingRecord** | 1 | 1 | Retained — **undocumented** (§5, highest priority) |
| PastoralNote | 1 | 1 | Retained — **undocumented** (§5) |
| BehaviourRecord | 1 | 1 | Retained — **undocumented** (§5) |
| Detention | 1 | 1 | Retained — **undocumented** (§5) |
| Exclusion | 1 | 1 | Retained — **undocumented** (§5) |
| TeacherPrediction | 1 | 1 | Retained — **undocumented** (§5) |
| AgentAuditEntry | 1 | 1 | Retained — **undocumented** (§5) |
| IntegrityPatternCase | 1 | 1 | Retained — **undocumented** (§5) |
| IlpParentResponse (parent's own text) | 1 | 1 | Retained — **undocumented** (§5) |
| **ParentConversation + ParentMessage** | 1 / 1 | 1 / 1 | Retained — **undocumented** (§5, second priority) |
| MsgThread (container only) | 1 | 1 | Retained — reasonable by design (§6) |
| **[CONTROL] SafeguardingRecord, Oakfield** | 1 | 1 | Untouched — **scoping confirmed correct** |
| **[CONTROL] BehaviourRecord, Oakfield** | 1 | 1 | Untouched — **scoping confirmed correct** |

25 categories genuinely deleted, matching `executeErasure`'s code exactly — no discrepancy between what the code claims and what actually happens on a live database.

## 4. What's retained — and correctly, verifiably documented

Both the code (`app/actions/gdpr.ts:601`, a comment directly above the anonymisation step) and the product's own UI (`ErasureConfirmModal.tsx`'s `RETAINED_DATA` array, visible to the admin *before* they click Execute — see `06-erasure-confirm-filled.png`) state:

> `IndividualLearningPlan`, `EhcpPlan`, `AssessPlanDoReview`, `SendStatus`, and `AuditLog` are intentionally retained under the **DfE 7-year retention obligation** (`SendStatus` specifically framed as a **safeguarding obligation** in the UI copy — a minor wording inconsistency between the code comment and the UI text, not a functional issue, but worth aligning).

This matches the test exactly: all four of these categories, plus the equivalent `IlpTarget` (cascades with its parent `IndividualLearningPlan`), survived erasure untouched. **This part of the workflow does exactly what it says it does**, and says so to the admin at the point of decision.

## 5. Gaps found — retained, but with no stated justification anywhere

For every category below, the record survived erasure, but is named in **neither** the code comment **nor** the UI's `DELETED_DATA` list **nor** its `RETAINED_DATA` list. That's the actual gap: it isn't that the product silently retains sensitive data under an undisclosed policy — it's that the product's own retention design doesn't currently have an opinion on this data at all. An admin reading the confirmation screen has no way to know these records will survive, because the screen doesn't mention them either way.

**Highest priority — `SafeguardingRecord`.** This is the single most sensitive model in the schema (welfare/child-protection/self-harm/domestic concerns, DSL notes). It is completely unaddressed by the erasure workflow. Real UK safeguarding practice (KCSIE) does have long, sometimes indefinite, retention expectations for certain safeguarding categories — so retention may well be the *correct* outcome here — but the code currently retains it by omission, not by policy. Given Phase 10.2 of this same checklist explicitly calls out "safeguarding-specific escalation" as a named operational concern, this is the gap most worth closing first, even if the fix is simply adding it to the `RETAINED_DATA` list with a real citation.

**Second priority — `ParentConversation` + `ParentMessage`.** Actual message *content* (not just metadata) authored by a real third party (the parent), left completely untouched. Unlike `SafeguardingRecord`, there's no obvious statutory reason to retain this — it reads as a genuine oversight rather than a defensible retention decision, and is the kind of gap a real Subject Access Request or complaint would surface.

**Everything else in this bucket** (`Plan`/`PlanTarget` and `ILP`/`ILPTarget`/`ILPNote` — two **legacy but still actively queried** SEND-plan models, confirmed live via a grep across `app/actions/plans.ts`, `app/send/ilp/*`, `app/parent/dashboard`, `app/parent/progress`, `lib/agents/plan-synthesis.ts`, and two cron routes, not dead code; `SendReviewLog`; `SendStatusReview`; `PastoralNote`; `BehaviourRecord`; `Detention`; `Exclusion`; `TeacherPrediction`; `AgentAuditEntry`; `IntegrityPatternCase`; `IlpParentResponse`) is lower-severity individually, but the pattern is the same throughout: real, queryable, per-student content, never considered by the one function in the codebase whose entire job is to consider it.

**Notable non-finding worth recording:** `IlpEvidenceEntry` looked like a possible gap on first read of the code (it's deleted `where: { submissionId: { in: submissionIds } }`, not by `studentId` directly, which could in principle miss rows) — but `submissionId` is a non-nullable field on that model, so every row is guaranteed to be reachable via the student's own submissions. Confirmed via the live count: 1 → 0. Not a gap.

## 6. `MsgThread` — reasonable partial retention, not a gap

The thread container itself survives (1 → 1), but the student's own participation record and every message *they* sent are gone (both 1 → 0). This is correct behaviour, not an oversight: a thread can have other legitimate participants (a teacher, in this test) who still need their own thread history to make sense — deleting the whole thread would delete the *other* person's data too, which the erasure request never asked for. Flagged here only so it isn't mistaken for a miss when read alongside the table above.

## 7. Documentation inconsistency, not a bug

`prisma/schema.prisma`'s comment on `ConsentRecord.studentId` says `// WondeStudent.id`. In actual practice (`recordConsent()` in `gdpr.ts`, sourced from `ParentStudentLink.studentId`, and `acceptTerms.ts`'s own inline comment "`User.id` of child") it is always a `User.id` — which is exactly what `executeErasure()` assumes and queries by, and the live test confirms the delete worked (1 → 0). The schema comment is simply stale; harmless today, but worth fixing so a future reader doesn't build something on the wrong assumption.

## 8. Separate minor bug found as a side effect of this test

`components/gdpr/DataSubjectRequestList.tsx` never calls `router.refresh()` after `NewDsrModal` closes. `submitDataSubjectRequest()` does call `revalidatePath('/admin/gdpr')` server-side, but per this repo's own documented gotcha ("Always call `router.refresh()` after server actions that modify data visible to the current component... `revalidatePath` alone is not enough for client components" — CLAUDE.md), the new request silently doesn't appear in the list until the next real navigation/reload. Confirmed live: the DSR was correctly written to the database immediately, but the on-screen table still said "0 requests" until the page was reloaded. Screenshots `04-dsr-logged.png` (stale) vs `04b-dsr-after-manual-reload.png` (correct) show this directly. Not fixed in this pass — flagged for the same reason as the coverage gaps above (report first, not silently patch).

## 9. schoolId scoping — confirmed correct

`executeErasure()` verifies the `DataSubjectRequest` and the target `User` both belong to the caller's `schoolId` before the transaction opens (`app/actions/gdpr.ts:517-528`), then reuses that verified `studentId` for every delete inside the transaction — the same "verify once, reuse the confirmed id" pattern found safe in the three prior tenant-scoping security sweeps. The live test proves it: Oakfield Academy's control student and their `SafeguardingRecord`/`BehaviourRecord` were completely unaffected by erasing a Demo School student — both control rows read back identical, byte-for-byte, after the erasure ran.

## What this session did and didn't do

Built: nothing changed in `app/actions/gdpr.ts` or any product code — per the task brief, gaps are reported here for a decision, not silently patched. The only code-adjacent artifact from this session is this document and the (now-deleted) test scripts used to run it.

## Recommendation for the next pass (not actioned here)

1. Decide the real retention policy for `SafeguardingRecord` specifically (likely: retain, per KCSIE — but say so in code and in the UI's `RETAINED_DATA` list rather than by omission).
2. Add `ParentConversation`/`ParentMessage` deletion to `executeErasure()` (same `senderType: 'PARENT'` content problem the threaded-messaging deletion already solved for `MsgMessage`).
3. Decide whether the legacy `Plan` and `ILP` models are still in active use long-term or being sunset — if active, they need the same delete/retain treatment as their `IndividualLearningPlan`/`IlpTarget` counterparts; if being sunset, that's worth noting so nobody erasure-tests against them again by surprise.
4. One-line fix: `router.refresh()` in `DataSubjectRequestList`'s `NewDsrModal` `onClose` handler.
5. One-line fix: correct the stale `// WondeStudent.id` comment on `ConsentRecord.studentId`.
