# Omnis — dedicated read-through: send-support.ts, safeguarding.ts, students.ts (2026-08-30)

Third security pass in this series, closing out the specific "still outstanding" item from the
2026-08-27 sweep: `send-support.ts`, `safeguarding.ts`, and `students.ts` were the 3 of the original
4 prioritised files (10 Jul 2026 tenancy-isolation audit) that had never been the *direct* target of
a full read-through — `ehcp.ts`, the 4th, got 5 fixes in the 26 Aug audit instead. This pass reads
every exported function in all three files line by line, checking each client-supplied id
(`studentId`, `targetId`, `ilpId`, `apdrId`, `concernId`, `classId`, etc.) against the same question
used in the two prior sweeps: is it verified against the caller's `schoolId` (directly or via a
scoped relation) before being used in a read or write, and is the caller's role checked where the
action is sensitive?

## STATUS: 12 findings fixed in send-support.ts + students.ts. `safeguarding.ts` read in full — clean,
no findings. Verified via `npx tsc --noEmit` (clean) and a full production `npm run build` (exit 0,
no errors). Committed as `ce77169` ("fix: close 12 cross-tenant IDOR/missing-role-check gaps in
send-support.ts and students.ts"). Not yet pushed/deployed.

## `safeguarding.ts` — clean

All 5 exported functions (`logSafeguardingRecord`, `updateSafeguardingRecord`, `getSafeguardingLog`,
`getStudentSafeguardingRecords`) check the caller's role against an explicit allowlist
(`STAFF_ROLES` / `VIEW_ROLES`) and scope every query and write by `schoolId` — either directly in the
`where` clause or via a `findFirst` ownership check (`{ id, schoolId }`) before any `update`. Given
this is the single most sensitive file in the app (safeguarding referrals, DSL notes), the tight,
consistent scoping here is worth calling out as the standard the other two files were checked
against.

## `send-support.ts` — 11 findings, all fixed

This file (69 exported functions, ~4850 lines) is where nearly all findings landed. The bug shape
matches the two prior sweeps almost exactly: a handful of functions verify the target id belongs to
the caller's school, and a scattered set of siblings — sometimes right next to a correctly-scoped
function doing the identical thing — don't.

### CRITICAL

1. **`generateIlpGoalsForStudent(studentId)`** (SENCO "Auto-Generate ILP" per-student modal). The
   student lookup, `SendStatus` (needArea/activeStatus), `StudentBaseline` scores, full
   `StudentLearningProfile` (Bloom's performance, strengths/development areas, learning format
   notes), and recent graded `Submission`s were **all fetched with no `schoolId` check** — five
   separate unscoped queries keyed only on the client-supplied `studentId`. All of that — a real
   student's name, SEND need area, and academic profile from any school on the platform — is folded
   into an AI prompt and the AI's response, including the student's real name, is **returned directly
   to the caller**. Any SENCO/SLT/SCHOOL_ADMIN could read another school's SEND record for an
   arbitrary student id.
   **Fix:** added a `prisma.user.findFirst({ where: { id: studentId, schoolId: user.schoolId, role: 'STUDENT' } })`
   ownership check as the first thing the function does (matching `generateILPForStudent`'s existing
   pattern earlier in the same file); returns `{ ok: false, error: 'Student not found' }` before any
   of the five unscoped queries run.

2. **`updateIlpTarget(targetId, status, progressNotes, newTargetDate)`** — write-level IDOR. Fetches
   `current` (including `ilp.schoolId`) via `findUnique` but never checks it against the caller's
   school before calling `.update()`. Any staff role (`TEACHER` included) could pass any ILP target
   id from **any school** and mutate its status, progress notes, or target date. Its sibling function
   directly below it in the file, `updateIlpTargetText`, has the exact correct check
   (`if (current.ilp.schoolId !== schoolId) throw new Error('Forbidden')`) — this one was simply
   missing it.
   **Fix:** added `if (!current || current.ilp.schoolId !== user.schoolId) throw new Error('Target not found')`
   immediately after the fetch, before the update.

### HIGH

3. **`generateLearnerPassportInternal(studentId, _createdByUserId, schoolId)`** — the shared K Plan
   generator, reachable unverified via the exported `generateLearnerPassport(studentId)` and
   `regenerateLearnerPassport(studentId)` actions. Its student lookup (`prisma.user.findUnique`) was
   unscoped and pulled `sendStatus.needArea` (real SEND category — special-category data under UK
   GDPR Article 9) directly, with no gate on an ILP existing first. That real name + year group + SEND
   need area is used to build the K Plan AI prompt regardless of whether the student has any records
   in the caller's own school, and the AI output is persisted as a new `LearnerPassport` row stamped
   with the *caller's* `schoolId` — a genuine cross-tenant special-category data leak, not just a
   dangling write. (All of this function's *other* call sites — `approveGeneratedIlp`,
   `updateIlpTargetText`'s auto-sync, `completeAPDRReview` — already pass a studentId that was
   independently verified upstream, so the fix needed to sit in the shared helper itself rather than
   only in the two public wrappers.)
   **Fix:** the student lookup is now `prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } })`;
   the function returns early via its existing `if (!student) return` guard for a cross-tenant id.

4. **`createIlp(data)`** — SENCO's manual ILP creation form. `validated.studentId` was never checked
   against the caller's school before the `SendStatus` SEND-register guard, the `ILP.create()` write
   (stamped `schoolId: <caller's school>`, `studentId: <arbitrary>`), or the teacher/HOY notification
   step, which fetched the target's real name via an unscoped `user.findUnique` and broadcast it in
   notification text.
   **Fix:** added a `findFirst({ id, schoolId, role: 'STUDENT' })` check immediately after validation,
   throwing `'Student not found'` for a cross-tenant id; the later duplicate unscoped name lookup was
   removed and the verified record is reused for the notification text.

5. **`updateClassroomStrategies(studentId, strategies)`** (students.ts, see below), **`addPassportRecommendation`**,
   and **`saveLearningFormatNotes`** — same "HIGH" classification for the identical shape as #3/#4;
   listed once here and detailed under students.ts to avoid duplication.

### MEDIUM

6. **`raiseConcern(data)`** — `validated.studentId` was used to create a `SendConcern` +
   `SendReviewLog` + (for high-risk categories) an `EarlyWarningFlag` with no ownership check, and a
   separate unscoped `user.findUnique` fetched the target's real name to broadcast in SENCO/HOY
   notifications — a genuine cross-tenant name leak, plus spurious concern records tagged with a real
   cross-tenant student id.
   **Fix:** added a `findFirst({ id, schoolId, role: 'STUDENT' })` check right after schema validation,
   throwing if not found; the verified record replaces the later unscoped lookup.

7. **`generateAPDRInternal(studentId, createdByUserId, schoolId)`** (shared by
   `generateAPDRForStudent`, `approveGeneratedIlp`, and `completeAPDRReview`) — same unscoped-lookup
   shape as #3, but lower severity because the AI-content path is gated behind an already
   schoolId-scoped `IndividualLearningPlan` lookup (so cross-tenant calls fall through to the generic
   "To be completed by SENCO." fallback rather than leaking real SEND content). Still a genuine
   write-level IDOR: a SENCO could generate an APDR cycle record referencing a real student id from
   another school.
   **Fix:** added the same `findFirst({ id, schoolId, role: 'STUDENT' })` guard at the top of the
   internal helper, returning early (no-op) for a cross-tenant id — protects `generateAPDRForStudent`
   (the one caller that didn't already verify ownership) without weakening the other two.

8. **`logTeacherIntervention(studentId, note)`** — missing role check entirely (`requireAuth()` with
   no allowlist), so any authenticated user — including `STUDENT` or `PARENT` — could call it to spam
   every SENCO in the school with a fabricated "intervention confirmed" notification about an
   arbitrary student in the same school. Not cross-tenant (the student lookup was already correctly
   `schoolId`-scoped), but a real missing-role-check gap of the kind the 2026-08-27 sweep flagged in
   `createHomework()` and `confirmGradePrediction()`.
   **Fix:** added a staff-role allowlist (`TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SENCO, SLT,
   SCHOOL_ADMIN, COVER_MANAGER`) matching the same file's `raiseConcern()`/`getStudentConcerns()`.

## `students.ts` — 6 findings, all fixed

`getStudentFile()` — the file's main read path, used by every staff role viewing a student's SEND
record — was already correctly scoped: it verifies the student belongs to `schoolId` as the very
first query, then safely reuses that verified `studentId` for every subsequent query in the
`Promise.all`. The problems were all in the smaller write-path helpers around it.

### HIGH

1. **`updateClassroomStrategies(studentId, strategies)`** — find-or-create on
   `StudentLearningProfile` keyed by bare `studentId`, no ownership check. Because the `existing`
   branch is an `update` (not a scoped upsert), a staff member at School A passing School B's real
   `studentId` would silently **overwrite School B's actual student's Learning Passport classroom
   strategies** — the same overwrite shape as the 2026-08-27 sweep's `kplan.ts upsertKPlan()` finding.
   **Fix:** added a `findFirst({ id: studentId, schoolId: user.schoolId, role: 'STUDENT' })` check
   before touching `StudentLearningProfile` at all.

2. **`addPassportRecommendation(studentId, suggestion)`** — identical shape and identical fix.

3. **`saveLearningFormatNotes(studentId, notes)`** — identical shape and identical fix.

### MEDIUM

4. **`saveStudentNote(studentId, content)`** — `.create()`-only (never overwrites another school's
   data), but wrote a `StudentQuickNote` referencing an arbitrary, unverified `studentId` — no check
   the target is even a `STUDENT` at any school, let alone the caller's. Data-pollution risk (a note
   permanently associated with a real user id from another tenant) rather than a read/write leak,
   since the note is stamped with the caller's own `schoolId` and so never surfaces in the target
   school's own views.
   **Fix:** added the same `findFirst({ id, schoolId, role: 'STUDENT' })` ownership check before the
   create.

### LOW

5. **`bulkGenerateLearningPassports(classId)`** — the enrolment lookup used to build the class roster
   was `{ classId }` with no `class: { schoolId }` relation filter. The actual AI generation calls
   `generateLearningPassport()` per student, which independently re-verifies ownership (via
   `generateILPForStudent`'s pattern) and safely no-ops for cross-tenant ids — so no real data was at
   risk — but the returned `{ generated, skipped, errors }` counts leaked another school's class
   roster size to the caller. Matches the "weak existence oracle" class of finding the 2026-08-26
   audit explicitly logged as low-severity-not-fixed, but this one was cheap to close the same way
   `lessons.ts`'s `getSchoolResourceLibrary()` fix did in the 2026-08-27 sweep.
   **Fix:** added `class: { schoolId: staff.schoolId }` to the enrolment `where` clause.

6. **`generatePassportsForStudents(studentIds)`** — same shape: the bulk-select variant took a raw
   array of ids with no `schoolId` filter before checking existing profiles and generating. Same
   "counts leak, no actual data leak" severity as #5.
   **Fix:** the function now pre-filters `studentIds` to only those matching
   `{ id: { in: studentIds }, schoolId: staff.schoolId, role: 'STUDENT' }` before doing anything else;
   cross-tenant ids are folded into the existing `skipped` count rather than silently processed.

## Verification

- `npx tsc --noEmit` — clean, no errors.
- `npm run build` — production build completed successfully (exit 0), all routes compiled, no
  TypeScript or build errors introduced by these changes.
- E2E was not re-run for this pass (no UI/route changes — every fix is inside `app/actions/`
  server-action bodies, adding an ownership check ahead of existing logic). Recommend the next
  scheduled full E2E run (or the next `git push` to `main`, which triggers it via
  `.github/workflows/e2e.yml`) as confirmation, per this repo's normal pattern.

## Not covered by this pass

- The broader "540 REVIEW" bucket and the ~70 non-dynamic `app/api/export/**` routes flagged as
  unreviewed by the 2026-08-26 and 2026-08-27 sweeps remain unreviewed — out of scope for this
  specific 3-file read-through.
- `ehcp.ts` was not re-read here; it already received its dedicated pass (5 fixes) in the
  2026-08-26 audit.
- No schema changes were needed for any of these fixes — all are additional `findFirst`/ownership
  checks ahead of existing queries, the same low-risk pattern used throughout both prior sweeps.
