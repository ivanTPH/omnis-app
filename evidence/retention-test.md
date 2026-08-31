# Phase 8.3 — Retention & deletion in practice (2026-08-30, fixed & re-verified 2026-08-31)

## STATUS: all 15 previously-undocumented categories now have a stated, documented policy — 5 deleted, 9 retained-with-citation, 1 (AgentAuditEntry) deliberately left for a product decision rather than guessed. Re-run against a fresh synthetic leaver + a live control-school check confirms every fix works on the real database, not just in code. Two unrelated bugs the original test caught are also fixed.

---

## Session 2 (2026-08-31) — fixes implemented and re-verified

### What changed

**Deleted, per decisions confirmed 2026-08-31** — `executeErasure()` in `app/actions/gdpr.ts` now also deletes:
- `ParentConversation` + `ParentMessage` (parent-teacher message content — deleted the same way `MsgMessage` already was; messages removed before their parent conversation, since `ParentMessage` has no cascade)
- `TeacherPrediction`
- `IntegrityPatternCase`
- `IlpParentResponse`

**Retained, with a real citation now — nothing changed in the database behaviour, only in what the code and UI state:**
- `SafeguardingRecord` — **retained per KCSIE safeguarding guidance** (deliberately no fabricated year figure — the codebase doesn't have one, so the citation states the guidance by name rather than inventing a number)
- Legacy `Plan`/`PlanTarget`/`PlanStrategy`/`PlanReviewCycle` and legacy `ILP`/`ILPTarget`/`ILPNote` — added to the same **7-year DfE retention obligation** bucket as `IndividualLearningPlan`/`IlpTarget`. Traced both legacy models before deciding (`Plan.targets: PlanTarget[]` with `needCategory`/`targetValue`/`achieved`; `ILP.needsSummary` + `ILPTarget.description`/`successCriteria`) — structurally the same kind of document (a SEND intervention plan with needs, targets, and success criteria) as `IndividualLearningPlan`, not something materially different. No reason found to treat them differently.
- `SendReviewLog`, `SendStatusReview` — retained, **tied to `SendStatus`'s existing retention** (they're review/action logs of that record, not independent data)
- `PastoralNote`, `BehaviourRecord`, `Detention`, `Exclusion` — retained per **school behavioural-records policy** (generic citation, not a fabricated period)

**Deliberately left undecided — flagged, not guessed:**
- `AgentAuditEntry` — **not added to either list.** This model is explicitly documented in its own schema comment as "Append-only — never updated after insert," the same design principle as `AuditLog` (which the existing retained-list already covers "for audit trail integrity"). That's a real, found reason it *might* belong in the same bucket — but it's also plausibly closer to `TeacherPrediction`/`IntegrityPatternCase` (ordinary per-student AI output with no independent accountability purpose once the pupil has left). Per the instruction not to guess on genuinely unclear cases, this one is left exactly as it was — retained by omission, not by policy — and reported here for a decision. The code comment in `gdpr.ts` says so explicitly (see below) rather than silently doing nothing.

**Two unrelated bugs fixed:**
- `components/gdpr/DataSubjectRequestList.tsx` — `NewDsrModal`'s `onClose` now calls `router.refresh()` in addition to closing the modal, matching this repo's own documented gotcha (CLAUDE.md: `revalidatePath` alone isn't enough for a client component holding server-fetched props as initial state).
- `prisma/schema.prisma` — `ConsentRecord.studentId`'s comment corrected from the stale `// WondeStudent.id` to `// User.id of the child`, matching what the code has always actually stored and queried.

### Code changes, file by file

- `app/actions/gdpr.ts` — `executeErasure()`: 3 new `deleteMany` calls (`ilpParentResponse`, `integrityPatternCase`, `teacherPrediction`) plus a new conversation-then-messages block for `ParentConversation`/`ParentMessage`. Retention comment above the anonymisation step rewritten to enumerate every category and its citation (previously named 5 categories with one blanket reason; now names all of them with the right reason each, and explicitly flags `AgentAuditEntry` as undecided).
- `components/gdpr/ErasureConfirmModal.tsx` — `DELETED_DATA` gained 3 new lines (parent home-progress notes, academic integrity cases, teacher grade predictions) and the "Messaging history" line now says "(including parent-teacher conversations)". `RETAINED_DATA` gained 4 new lines (SEND review logs, safeguarding records, behavioural records, and the ILP line now says "(including legacy SEND plan records)").
- `components/gdpr/DataSubjectRequestList.tsx` — `router.refresh()` fix.
- `prisma/schema.prisma` — comment fix only, no field/type change.

### Re-test method — same approach as the original audit, run again end to end

A **second** synthetic leaver ("ErasureTwo TestStudent") was built with linked data across all 30 `studentId`-bearing models (57 records/flags, 0 failures this run — last session's one schema-mismatch was already known and avoided), erasure triggered through the real `/admin/gdpr` UI via Playwright (not a direct function call), counts taken by direct database query before and after. A control record was again planted on the same real Oakfield Academy student used last session ("Joseph Walker") to re-confirm schoolId scoping.

**Side finding while re-running:** last session's own cleanup script had a bug — it deleted control records by `ids.safeguardingRecord`/`ids.behaviourRecord` (the *test student's* record ids) instead of `ids.controlSafeguardingRecord`/`ids.controlBehaviourRecord` (the *control* record ids), so the first session's control rows were never actually removed from Joseph Walker's record. This surfaced immediately in this session's BEFORE count (2, not 1, for both control categories) and was corrected in this session's cleanup — both categories are back to 0 for Joseph Walker now, and this document's own history is the reason to be suspicious of "should be back to normal" claims rather than just trusting them.

### Full before/after count, this re-test

| Category | Before | After | Outcome |
|---|---|---|---|
| User row itself | 1 | 1 | Retained, PII anonymised (unchanged from session 1) |
| UserSettings, UserAccessibilitySettings, Enrolment, Submission, IlpEvidenceEntry, KPlan, LearnerPassport, TaNote, ParentContactEntry, StudentQuickNote, SendConcern, EarlyWarningFlag, RevisionExam, RevisionSession, RevisionConfidence, StudentBaseline, StudentLearningProfile, AgentSnapshot, ParentStudentLink, ParentChildLink, MsgParticipant, MsgMessage, ConsentRecord, PasswordResetToken, Notification, SendNotification | all 1 | all 0 | **Deleted** (unchanged from session 1 — 25 categories, still correct) |
| **ParentConversation** | 1 | 0 | **Newly deleted — fix confirmed working** |
| **ParentMessage** | 1 | 0 | **Newly deleted — fix confirmed working** |
| **TeacherPrediction** | 1 | 0 | **Newly deleted — fix confirmed working** |
| **IntegrityPatternCase** | 1 | 0 | **Newly deleted — fix confirmed working** |
| **IlpParentResponse** | 1 | 0 | **Newly deleted — fix confirmed working** |
| IndividualLearningPlan, IlpTarget, EhcpPlan, AssessPlanDoReview, SendStatus | all 1 | all 1 | Retained — documented since session 1, unchanged |
| **legacy Plan** | 1 | 1 | Retained — **newly documented** |
| **legacy PlanTarget** | 1 | 1 | Retained — **newly documented** |
| **legacy ILP** | 1 | 1 | Retained — **newly documented** |
| **legacy ILPTarget** | 1 | 1 | Retained — **newly documented** |
| **legacy ILPNote** | 1 | 1 | Retained — **newly documented** |
| **SendReviewLog** | 1 | 1 | Retained — **newly documented** |
| **SendStatusReview** | 1 | 1 | Retained — **newly documented** |
| **SafeguardingRecord** | 1 | 1 | Retained — **newly documented (highest priority, now closed)** |
| **PastoralNote** | 1 | 1 | Retained — **newly documented** |
| **BehaviourRecord** | 1 | 1 | Retained — **newly documented** |
| **Detention** | 1 | 1 | Retained — **newly documented** |
| **Exclusion** | 1 | 1 | Retained — **newly documented** |
| AgentAuditEntry | 1 | 1 | Retained — **still flagged, not decided (see above)** |
| MsgThread (container only) | 1 | 1 | Retained — reasonable by design (unchanged from session 1) |
| **[CONTROL] SafeguardingRecord, Oakfield** | 2 (see side finding above) | 2 | Untouched — **scoping re-confirmed correct** |
| **[CONTROL] BehaviourRecord, Oakfield** | 2 (see side finding above) | 2 | Untouched — **scoping re-confirmed correct** |

Every one of the 5 new deletions went from 1 → 0. Every one of the 9 newly-documented retentions stayed at 1 → 1 (correct — they're meant to survive, just with a citation now). `AgentAuditEntry` stayed 1 → 1 too, correctly unaffected since no code change was made for it. Control records were completely unaffected by the second erasure, same as the first.

### `router.refresh()` fix — verified with real timing, not assumed

The first attempt to verify this specific fix produced a false negative: a fixed ~1.5s wait after the network request started wasn't long enough — this dev environment's round-trip to the remote Supabase database for this page's data fetch genuinely takes several seconds (confirmed separately: a plain fresh navigation to the same page took 4.8s end-to-end in the server log). Re-tested properly with a polling loop instead of a fixed wait:

```
BEFORE: 2 requests
t+1s through t+4s: 2 requests
t+5s: 3 requests   ← router.refresh()'s fetch completed and the list updated
t+6s through t+12s: 3 requests (stable)
```

**Confirmed working** — no manual page reload needed, the fix does what CLAUDE.md's own gotcha note says it needs to do. The ~5s delay is real Supabase network latency in this dev setup, not a defect in the fix itself.

### Screenshots

`evidence/retention-test-screenshots-v2/` — `01` new-request modal, `02` list immediately after submit (this one still shows the fix mid-flight, see the timing note above), `03` the erasure confirmation modal showing the full updated `DELETED_DATA`/`RETAINED_DATA` text live in the product, `04` `CONFIRM` typed, `05` erasure executed, `06` the isolated `router.refresh()` timing check.

All test data (both this session's and the leftover from session 1) was deleted after the test completed — the demo school and Oakfield Academy are back to their pre-test state, confirmed by a final direct-query check.

---

## Session 1 (2026-08-30) — original audit (for full context/history)

*(Findings below are as originally recorded. All numbered gaps have since been addressed per Session 2 above; kept verbatim as the record of what was found and why, since the fixes were made from these exact findings.)*

### 1. Where the workflow lives

The DPIA's "leaver deletion workflow" is **`executeErasure(dsrId)`** in `app/actions/gdpr.ts:511`, reachable from `/admin/gdpr` → "Data Subject Requests" tab → **manually**, not automatically:

1. SCHOOL_ADMIN or SLT logs a Data Subject Request (`submitDataSubjectRequest`) of type `erasure` against a specific student, via `NewDsrModal`.
2. SCHOOL_ADMIN opens the request row and clicks **Execute** (`DataSubjectRequestList.tsx`), which opens `ErasureConfirmModal` — a confirmation screen listing what will be deleted vs. retained, gated behind typing the literal word `CONFIRM`.
3. `executeErasure()` runs, `SCHOOL_ADMIN`-only (checked in code, not just UI), inside a single `$transaction` with a 30s timeout.

**This is not tied to any "leaver" flag.** There is no automatic trigger — not from the year-rollover cron (`app/api/cron/year-rollover/route.ts`, which only sets Y13 students `isActive=false`, never deletes anything), not from any other event. It is a fully manual admin action, and it only exists for **students** — `getStudentsForDsr()` is scoped to `role: 'STUDENT'`; there is no equivalent staff-erasure workflow.

### 2. Test method

A synthetic "leaver" was built with realistic linked data across every model in the schema that carries a `studentId`/`childId` foreign key (30 categories), erasure triggered through the actual product UI (Playwright, not a bypassed function call), counts taken by direct query before and after. A control record (a real, pre-existing student, "Joseph Walker," at Oakfield Academy) was used to catch cross-tenant leakage.

### 3. Result — 25 deleted, 5 retained-and-documented, 15 retained-with-no-documentation

25 categories genuinely deleted, matching `executeErasure`'s code exactly. `IndividualLearningPlan`, `EhcpPlan`, `AssessPlanDoReview`, `SendStatus` (+ `IlpTarget` via cascade) retained under a stated **DfE 7-year retention obligation**, in both the code comment and the confirmation modal's own `RETAINED_DATA` list.

### 4. Gaps found (all closed in Session 2 above)

**Highest priority — `SafeguardingRecord`.** The single most sensitive model in the schema, completely unaddressed by the erasure workflow — retained by omission, not by policy.

**Second priority — `ParentConversation` + `ParentMessage`.** Real third-party message content, left completely untouched with no obvious statutory reason.

**Everything else:** legacy `Plan`/`PlanTarget` and `ILP`/`ILPTarget`/`ILPNote` (confirmed still actively queried, not dead code), `SendReviewLog`, `SendStatusReview`, `PastoralNote`, `BehaviourRecord`, `Detention`, `Exclusion`, `TeacherPrediction`, `AgentAuditEntry`, `IntegrityPatternCase`, `IlpParentResponse` — real, queryable per-student content, never considered by the one function whose job is to consider it.

**Notable non-finding:** `IlpEvidenceEntry` looked like a possible gap (deleted via `submissionId`, not `studentId` directly) but `submissionId` is non-nullable, so every row is guaranteed reachable via the student's own submissions. Confirmed via live count. Not a gap.

### 5. `MsgThread` — reasonable partial retention, not a gap

The thread container survives, but the student's own participation record and every message they sent are gone. Correct behaviour — a thread can have other legitimate participants (e.g. a teacher) whose own data shouldn't be deleted by someone else's erasure request.

### 6. schoolId scoping — confirmed correct

`executeErasure()` verifies the `DataSubjectRequest` and target `User` both belong to the caller's `schoolId` before the transaction opens, then reuses that verified `studentId` for every delete — the same "verify once, reuse the confirmed id" pattern found safe in the three prior tenant-scoping security sweeps. The control-school test proved it live.
