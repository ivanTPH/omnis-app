# Omnis — schoolId tenant-scoping audit (2026-08-26)

Pre-launch security audit of Prisma query call sites across `app/actions/**`, `app/api/**`, and `lib/**` for cross-tenant (cross-school) data leaks. Every tenant-scoped model must be filtered by `schoolId` (directly or via a scoped parent relation) — Omnis is multi-tenant, and a missing check means one school can read or write another school's SEND/EHCP/safeguarding records.

Scope: ~1,676 tenant-model Prisma call sites across ~60 action files, ~90 API routes, and lib/. An automated triage pass flagged call sites with no `schoolId` anywhere in the enclosing function; ~102 highest-signal candidates plus a sample of dynamic `[id]` API routes were manually read in full context. Not exhaustive — see "Not yet reviewed" below.

## STATUS: 7 RISKY findings — all fixed, tested, deployed (2026-08-26)

Fixed in commit `2953631` ("fix: scope 7 cross-tenant IDOR vulnerabilities to schoolId (security audit)"), verified via `tsc --noEmit` (clean), `eslint` (0 errors), a full production build, and a full Playwright e2e run against that build (458/458 passed, no regressions). Deployed to omnis.education via Coolify (not Vercel — Coolify is the actual production host; a separate Vercel project also auto-deploys from the same GitHub repo but is not what serves omnis.education). Manually verified live post-deploy.

## RISKY — confirmed exploitable cross-tenant IDOR (all fixed)

1. **`app/actions/academy.ts:38,55`** — `getAcademyStats()` / `getAcademySchools()`. `prisma.school.findMany({ where: { isActive: true } })` has no `schoolGroupId` filter. Any `ACADEMY_ADMIN`/`PLATFORM_ADMIN` sees every school on the platform's SEND/EHCP/safeguarding stats, not just their own trust. Affects `/academy/dashboard`, `/academy/schools`, `/academy/send`, `/academy/reports`, `/api/export/academy-report`. **Highest severity.**
   **Fix:** added `requireAcademy()` schoolGroupId lookup + `academyScopeWhere()` helper — ACADEMY_ADMIN now scoped to their own trust (or own school if not in a trust); PLATFORM_ADMIN unchanged (genuinely cross-platform). `getAcademyStats()` now derives all six sub-counts from the scoped school id list instead of querying platform-wide.

2. **`app/actions/ehcp.ts`** — five functions reachable by any staff role via `requireSencoOrStaff()` (role-only check):
   - `getStudentSubmissionsForEvidence(studentId)` (line 1239) — no `schoolId`.
   - `getEhcpAuditLog(ehcpId)` (line 1276) — no `schoolId`; leaked full EHCP change history for any school given an `ehcpId`.
   - `getPendingEvidenceSuggestions(studentId)` (line 1320) — no `schoolId`.
   - `confirmEvidenceSuggestion(evidenceId)` (lines 1370–1387) — **write-level IDOR**.
   - `dismissEvidenceSuggestion(evidenceId)` (lines 1405–1411) — same write-level IDOR.
   **Fix:** added `schoolId: user.schoolId` to the submission/ehcpPlan lookups; added `ehcp: { schoolId: user.schoolId }` relation filter to the audit log query; switched the two evidence-suggestion functions from `findUnique` to `findFirst` with `outcome: { ehcp: { schoolId } }` nested scoping.

3. **`app/actions/send-support.ts:1496`** — `getIlpAuditLog(ilpId)`, and **`:2724`** — `getAPDRAuditLog(apdrId)`. Same audit-log shape as #2.
   **Fix:** added `ilp: { schoolId: user.schoolId }` / `apdr: { schoolId: user.schoolId }` relation filters, matching the file's own `getPendingIlpEdits()` pattern.

4. **`app/actions/agent-insights.ts:27`** — `getAgentInsights(studentId)`. `requireAuth()` had **no role restriction** (students/parents could call it), and the query had no `schoolId`.
   **Fix:** restricted to staff roles (`TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SENCO, SLT, SCHOOL_ADMIN, TEACHING_ASSISTANT` — matching `students.ts`'s own `requireStaff()` list, its only caller) and added `schoolId: user.schoolId` to the `agentSnapshot` query.

5. **`app/actions/communications.ts:62`** — `sendCommunication()`, `CLASS_` recipient scope. `classId` was client-supplied, never checked against `user.schoolId`.
   **Fix:** added `class: { schoolId: user.schoolId }` relation filter to the enrolment lookup.

6. **`app/actions/cover.ts:499`** — `updateAssignmentStatus(assignmentId, status)`. No `schoolId` — cross-tenant write to another school's cover assignment.
   **Fix:** added a `findFirst({ where: { id, schoolId } })` ownership check before the update, matching `deleteAbsence()`'s existing pattern in the same file.

7. **`app/api/student-photo/[userId]/route.ts`** — only checked `auth()` (any logged-in user). No school or role check.
   **Fix:** switched the `user.findUnique` lookup to `findFirst` scoped by the caller's `schoolId` from the session; falls back to the existing generic-initials avatar for cross-school/missing ids (no behavior change for the legitimate "no photo" case).

## Minor / low-severity (not fixed — logged for awareness, not exploitable as a leak)

- `app/actions/gdpr.ts` `recordConsent()` — client-supplied `purposeId` isn't checked against the caller's school. Data-integrity issue, not a read/write leak.
- `app/actions/student.ts` `saveTopicConfidence(homeworkId)` — no `schoolId` on the lookup, but gated by a submission-ownership check right after; cross-tenant ids just 404. Weak existence oracle at most.

## NEEDS REVIEW — not fully resolved, not yet actioned

- `lib/agents/snapshot.ts` `getSnapshot()` and its 6 callers (`plan-synthesis.ts`, `quality.ts`, `engage.ts`, `coach.ts`, `evidence-agent.ts`) — no `schoolId` on the query itself; likely called from already-scoped batch loops, but upstream scoping wasn't traced for each caller.
- Automated scan's broader "540 REVIEW" bucket (schoolId present in the function but not verifiably tied to the id in question) — spot-checked across `messaging.ts`, `communications.ts`, `accessibility.ts`, `revision.ts`, `safeguarding.ts`, `analytics.ts`, rest of `ehcp.ts` — all correctly scoped in the sample. Not all 540 individually re-verified.
- `app/api/export/**` (~90 routes): only 5 of 18 dynamic `[id]` export routes checked (`ehcp-plan`, `apdr`, `ilp-report`, `gdpr-data`, `student-progress` — all correct). Not reviewed: `class-report`, `ehcp-review`, `attendance-letter`, `lesson-plan`, `student`, `k-plan`, `report-card`, `revision-progress`, `homework`, `year-report`, `intervention-log`, `parent-contact-log`, `parent-report`, plus ~70 non-dynamic export routes.
- `app/api/cron/**` (18 routes) — only `review-due` spot-checked (correct). Rest deprioritized (require `CRON_SECRET`, not attacker-controlled per-tenant).
- Action files not reached at all: `plans.ts`, `kplan.ts`, `year-group-plans.ts`, `teacher-send.ts`, `slt-send.ts`, `behaviour.ts`, `detentions.ts`, `exclusions.ts`, most of `integrity.ts`, `wonde.ts`, `oak.ts`, `homework.ts`, `lessons.ts`, `assessments.ts`, `attainment-benchmark.ts`, `hod.ts`, `population.ts`, `rag.ts`, `search.ts`, `dashboard.ts`, `adaptive-learning.ts`, `demo.ts`, `ilp-parent.ts`, `student-contact.ts`, `guide-chat.ts`, Wonde/Arbor/ClassCharts sync routes, AI-generation routes (`generate-ilp`, `generate-homework`).

## SAFE coverage — general impression

The large majority of the ~1,676 call sites are correctly scoped, via two consistent patterns: explicit `where: { id, schoolId }` / nested relation scoping (`class: { schoolId }`, `student: { schoolId }`, `ilp: { schoolId }`), and self-scoping via session-derived `userId` (safe by construction). `lib/session.ts requireAuth()` returning `{id, schoolId, schoolName, role}` is used consistently.

The 7 RISKY findings clustered in one recognizable bug shape: audit-log / secondary-record getters that take a raw record id and skip the schoolId check the file's own "main" record fetcher already does correctly. Worth a dedicated grep across all `*AuditLog`/`*AuditEntry` getters if any new ones are added in future, since the pattern could repeat.

## Next steps

A second pass covering the "NEEDS REVIEW" list above (particularly the 13 unreviewed dynamic export routes, which generate PDFs containing student data) would be worthwhile before or shortly after launch, but is not blocking — none of those were confirmed exploitable, just not yet checked.
