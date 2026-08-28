# Omnis — performance/efficiency sweep (2026-08-28)

The third hardening-phase thread (after security, 27 Aug, and resilience/error-handling,
27 Aug) — the "run efficiently and scale" thread flagged but not started in
`docs/audit/2026-08-27-resilience-audit.md`'s "Not covered by this pass" section.
Scope: structural risk against the go-live checklist's Phase 6.1 targets (roster
<3s, analytics <5s, homework gen <30s, ILP gen <60s, at 1,500-student scale) —
no load test has actually run yet, so this is a structural-risk sweep, not
measured numbers.

## STATUS: 5 findings fixed, committed. Full analytics dashboard rewrite (DB-side
aggregation) deliberately deferred — flagged as real feature work, not something
to rush through blind edits given the correctness risk on academic data.

## Fixed

1. **CRITICAL (structural) — all 4 nightly agent crons processed schools
   sequentially inside one 300s request.** `app/api/cron/agent-{coach,quality,
   plan-synthesis,engage}/route.ts` each did `for (const school of schools) {
   await run*BatchForSchool(school.id) }` — one school fully finishing before
   the next started. Each school's own internal per-student batching (5
   students at a time, plus an inter-batch pause) already costs 90-150s+ for a
   150-student school. Once the school count grows into the dozens, the loop
   hits the `maxDuration = 300` ceiling partway through the (unordered) school
   list — schools later in the list simply never get their agent run that
   night, with no distinction in the response between "ran, found nothing" and
   "never reached." This doesn't show up as a slow page; it shows up as
   SEND-relevant agent insights silently going stale for some fraction of
   schools, worse as the school count grows — exactly the kind of failure this
   session's resilience audit was trying to close, just from a different
   cause. Fixed by adding `lib/batch.ts` (`runBounded`, a small worker-pool
   helper: N workers pull from a shared cursor rather than fixed-size chunks,
   so a fast school doesn't wait on a slow sibling in the same chunk) and
   switching all 4 routes to `runBounded(schools, ..., 3)` — 3 schools
   processing concurrently rather than 1. Concurrency was kept deliberately
   low (not unbounded) since each school's batch already does its own
   concurrent DB + Anthropic calls, and today's earlier production incident
   was itself a connection-pool exhaustion — 3× headroom against that risk
   felt like the right conservative starting point, not "as parallel as
   possible."

2. **MEDIUM — Oak curriculum topic lookups repeated the same full-text scan
   once per student, despite comments claiming a cache.** `lib/oak-content.ts`'s
   `findOakDataForTopics()` — used by both `coach.ts` and `engage.ts`, each
   annotated "module cache — no extra DB round-trips on warm container" — ran
   a fresh `prisma.oakLesson.findMany()` with a leading-wildcard
   `contains`/`insensitive` OR-clause across the 10k+-row Oak table on every
   call, with no cache check beforehand (it only populated the *by-slug* cache
   afterward, which only helps a different lookup path). Since students in the
   same class/subject frequently share weak topics, the same scan repeated
   once per eligible student in every coach/engage batch. Fixed by adding a
   second cache (`byTopicQuery`, same 500-entry/24h-TTL shape as the existing
   `bySlug` cache) keyed on the normalised `(topics, subjectSlug, limit)`
   tuple, checked before querying and populated after — matching the pattern
   `quality.ts`'s `getOakDataForLesson()` already correctly used.

3. **MEDIUM — CSV student roster import awaited a live welcome email inside
   its per-row loop, and a failed send mislabelled a successfully-created
   account as an error.** `app/actions/admin.ts`'s `importStudents()` did, per
   row, sequentially: dedupe check, `bcrypt.hash`, `user.create`, optional
   class enrolment, activation token, then `await sendWelcomeAccountEmail(...)`
   — real outbound network I/O blocking the next row. For a realistic
   whole-school import this serialised to minutes of pure email latency in one
   request. Separately, since the email send sat inside the same `try` block
   as the account creation, a failed send caused the row to be reported in
   `result.errors` even though the user, enrolment, and activation token had
   already committed successfully — a real account existed, it just never got
   told about it, and the import report actively said otherwise. Fixed by
   decoupling: the per-row loop now only does DB writes and queues an email
   job; after the loop, all queued emails send via `runBounded(..., 5)`, with
   send failures tracked as their own distinct message ("account created, but
   welcome email failed to send") rather than folded into account-creation
   errors.

4. **LOW/MEDIUM — bulk AI "Learning Passport" generation was fully
   sequential, one with an explicit 500ms inter-call delay.**
   `app/actions/students.ts`'s `bulkGenerateLearningPassports()` and
   `generatePassportsForStudents()` both looped one student at a time over a
   real Anthropic call each; the latter additionally slept 500ms between every
   student. For a class of 30 this was 30x one generation's latency
   sequentially. Fixed both to use `runBounded(..., 3)` — same conservative
   concurrency philosophy as the agent crons (a real external API, so capped
   low rather than unbounded), removing the fixed sleep entirely since bounded
   concurrency is a more direct way to stay within rate limits than a flat
   delay between every call regardless of how many are in flight.

5. **LOW — analytics dashboard recomputed two O(n×m) scans on every load.**
   `app/actions/analytics.ts`'s `getStudentPerformance()` did
   `homeworks.find(h => h.id === sub.homeworkId)` inside a loop over every
   submission (O(submissions × homeworks)), and separately
   `homeworks.filter(h => enrolledClasses.has(h.classId))` inside a loop over
   every student (O(students × homeworks)) — at 1,500 students with a year's
   worth of homework, both scans get expensive independent of DB round-trip
   time. Fixed by pre-building `homeworkById` (Map) and `homeworksByClassId`
   (Map of arrays) once up front and using O(1) lookups in both loops. This is
   a pure access-pattern change — the `assignedHws` reordering it introduces
   (grouped by class rather than the original fetch order) doesn't affect
   output, since the resulting `hwRows` is explicitly re-sorted by `dueAt`
   immediately after, and every aggregate computed from it (completion rate,
   avg score, class-vs-student delta) is order-independent.

## Not fixed — deliberately deferred, needs a proper pass rather than a rushed one

**The bigger analytics dashboard risk: unbounded whole-school queries +
JS-side aggregation, not yet DB-side.** `getStudentPerformance()`'s
`submission.findMany` has no `take` when called with no filters (an SLT/SENCO
user clicking "Run" with nothing selected resolves to every student and
potentially years of submissions), and `getClassSummaries()`'s no-filter path
fetches every class with a nested `homework: { submissions } }` include,
similarly unbounded. All averages (completion rate, avg score, class-vs-student
delta) are computed in JS after the full fetch rather than with Prisma's
`groupBy`/`aggregate`. This is the single biggest match to the checklist's
"analytics dashboard <5s" target and the highest remaining scale risk in this
sweep — but a correct fix means redesigning the query shape (DB-side
aggregation) and needs to preserve exact output semantics the UI depends on
(`components/StudentAnalyticsView.tsx` and others consume the current shape
directly). Silently adding a `take` cap as a stopgap was considered and
rejected: capping an unbounded fetch without changing the aggregation logic
would silently compute averages over an arbitrary subset of a student's data
rather than all of it — for a SEND product where under/over-reporting a
student's actual performance has real stakes, a dashboard that's occasionally
slow is a much smaller problem than one that's fast but quietly wrong. This
needs a dedicated pass with real before/after verification against the UI, not
a blind edit in the same sweep as the smaller fixes above.

**`getClassTopicHeatmap()` (same file) does not have this problem** — it's
already scoped to one class with `take: 20` on homeworks, and stands as the
existing example of the right pattern to extend to the two functions above.

## Not covered by this pass

- The DB-side analytics rewrite above.
- Load testing itself (Phase 6.1) — still hasn't actually run once with real
  numbers; everything in this sweep is structural-risk analysis, not measured
  before/after timings.
- A full audit of every Prisma index against every query shape — spot-checked
  the highest-traffic models (`Homework`, `Submission`, `AgentSnapshot`,
  `AuditLog`, `AgentAuditEntry`) and found them well-matched to actual query
  patterns; no missing-index red flags turned up, but this wasn't exhaustive
  across every model.
