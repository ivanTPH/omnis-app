# Phase 6.2 — Failure/Chaos Testing: Scenarios 2 & 4

**Date:** 31 August 2026
**Scope:** Scenario 2 (AI provider timeout during homework/ILP generation) and
Scenario 4 (concurrent grade edits on the same submission) from
`evidence/phase6-load-resilience/failure-test-plan.md`. Scenarios 1 (Wonde
downtime) and 3 (DB connection loss) were covered in the 27 Aug 2026 session
— see the Phase 6.2 entry in `OMNIS_GO_LIVE_TESTING_AND_ACCREDITATION_CHECKLIST.md`
and `docs/audit/2026-08-27-resilience-audit.md`.

Both scenarios below were traced in the real code (not assumed), reproduced
live against the real Anthropic API / real production database, fixed where
a real gap was found, and re-verified live after the fix. No formal k6/chaos
harness was used — both are still blocked on the same isolated-environment
need as 6.1 — but the actual failure mechanism in each case was triggered for
real, not simulated in the abstract.

---

## Scenario 2 — AI provider (Claude API) timeout during homework/ILP generation

### What was traced

Every Anthropic call site feeding the homework and ILP/EHCP/APDR generation
pipelines was enumerated and checked for an explicit timeout, retry policy,
and user-facing error path:

| File | Function | Call shape | Live caller? |
|---|---|---|---|
| `app/api/ai/generate-homework/route.ts` | route handler | `client.messages.stream()` (SSE) | Yes — `SetHomeworkModal.tsx`, `LessonFolder.tsx` |
| `app/api/ai/generate-ilp/route.ts` | route handler | `client.messages.stream()` (SSE) | Yes — SENCO ILP generation UI |
| `app/api/senco/generate-ilps/route.ts` | `POST` | `client.messages.create()` (bulk, one-shot per student) | Yes — SENCO bulk-generate |
| `app/actions/send-support.ts` | `generateILPForStudent`, `generateAPDRInternal`, `generateLearnerPassportInternal`, `generateSupportSnapshotInternal`, `generateIlpGoalsForStudent`, `generateILPFromConcern` | `client.messages.create()` (one-shot) | Yes, all 6 |
| `app/actions/ehcp.ts` | `generateIlpProgressReport`, `generateEhcpAnnualReview`, `generateEHCPFromILP` | `client.messages.create()` (one-shot) | Yes, all 3 |
| `app/actions/homework.ts` | `generateHomeworkContent` | `client.messages.create()` (one-shot) | **No — dead code, see below** |
| `app/actions/homework.ts` | `generateHomeworkFromResources` | `client.messages.create()` (one-shot) | **No — dead code, see below** |

**Key finding — no call site set an explicit timeout or retry count.** Every
`new Anthropic({ apiKey })` construction relied on the SDK's own defaults.
Read directly from `node_modules/@anthropic-ai/sdk/client.js`:
`DEFAULT_TIMEOUT = 600_000` (10 minutes) and a default `maxRetries: 2` (i.e.
up to 3 attempts before the SDK itself gives up).

This deployment (Coolify — a persistent Node server, not Vercel serverless
functions) has no platform-level request duration cap backstopping this.
`app/api/ai/generate-homework/route.ts` sets `maxDuration = 120` but that
constant is a Vercel-only convention with no effect on Coolify; nothing
actually bounds a genuinely hung Anthropic call server-side except the SDK's
own 10-minute default. A hung call could therefore hold a request open for
up to ~10 minutes per attempt, ×3 attempts if the SDK's retry-on-timeout
logic fires (see below) — i.e. up to ~30 minutes worst case — with the user
watching an indefinite spinner and no error, unless the client-side guard in
`lib/ai-stream.ts` intervenes first.

**Client-side guard confirmed real (not assumed).** `lib/ai-stream.ts`'s
`streamAiRequest()` races each `reader.read()` against a 45-second timeout
via `Promise.race`, and surfaces `"Stream ended without a result event"` if
it fires. This is genuine and correctly wired — it's the reason the *client*
was never going to hang forever even before any server-side fix. But it does
nothing for the two one-shot (non-streaming) code paths
(`generate-ilps/route.ts`, and everything in `send-support.ts`/`ehcp.ts`),
which have no client-side stream to time out — those either resolve or the
underlying `fetch` hangs until the SDK's own 10-minute default gives up.

**Dead code found while tracing — corrected an early assumption.** I initially
treated `generateHomeworkContent` (called from `components/homework/
HomeworkCreatorV2.tsx`) as the most significant live gap, since on first read
its `catch` block silently swallowed any failure — including a timeout — and
returned generic stub content dressed up as a successful generation, with no
error surfaced to the teacher at all. Grepping for real mounting callers of
`HomeworkCreatorV2` across `app/` and `components/` found none — it is not
rendered from any route. The same is true of `generateHomeworkFromResources`
in the same file (only self-referencing log/comment strings reference it).
**Both are unreachable in production today.** They were still fixed (see
below), on the reasoning that dead code becoming live again later is a real
risk and the fix is essentially free once `lib/ai-timeouts.ts` exists — but
this is correctly characterised as defensive/future-proofing, not closing a
live gap. The actual live gap was the systemic missing-timeout on all 11 live
call sites, plus two further real bugs found on the ILP SSE route (below).

**Second real finding — `/api/ai/generate-ilp/route.ts` was missing 3
protections that `/api/ai/generate-homework/route.ts` already had:**
1. No `resultEmitted` tracking — the homework route uses this flag to avoid
   emitting a second, spurious `error` event from its `finally` block after
   a real result (or a real error) was already sent to the client; the ILP
   route had no such guard.
2. No `Content-Encoding: identity` response header — this is the exact
   Nginx-gzip-SSE-buffering bug (fixed on the homework route 5 Aug 2026,
   see `CLAUDE.md`'s "August 2026 Homework generation UX + streaming fixes"
   entry) that caused the homework route to appear to hang for the full
   generation duration because Nginx buffered the entire gzip'd SSE response
   until the stream closed. The ILP route had the identical vulnerability,
   undetected until now, because it hadn't been exercised under the same
   conditions that surfaced the original bug on the homework route.
3. No safety-net `finally` emit — if every earlier `emit(controller,
   {type:'error',...})` call site failed to run (e.g. an exception before
   any emit), the stream could close with `resultEmitted` never true and no
   event of any kind sent to the client, i.e. a silent hang from the
   client's perspective until its own 45s guard fired.

### What was tested live

1. **SDK retry/timeout mechanics, empirically confirmed against the real
   Anthropic API** (not assumed from documentation): a `new Anthropic({
   apiKey, timeout: 50 })` call with the SDK's default `maxRetries: 2`
   actually took **~1.5s** to finally reject — not 50ms — because the SDK
   silently retried the timed-out request twice more before giving up. With
   `maxRetries: 1` explicitly set, the same 50ms timeout took **~536ms** to
   reject (one retry, not two). This directly informed the fix: pinning
   `maxRetries: 1` bounds the worst case to "timeout × 2 attempts" instead of
   "timeout × 3 attempts," while still allowing one transient blip to
   recover automatically.

2. **Direct SSE-level reproduction against both live streaming routes**, using
   Playwright's `context.request.post()` to call `/api/ai/generate-homework`
   and `/api/ai/generate-ilp` directly and read the raw
   `text/event-stream` response body — a faithful proxy for what
   `lib/ai-stream.ts` actually consumes, chosen after a full-UI click-through
   attempt (LessonFolder → Homework tab → Generate with AI) failed on a
   locator that didn't match the live DOM in this route (`Homework tab`
   button role/name mismatch); rather than spend further time on Playwright
   selector debugging for a scenario the SSE-level test already proves
   authoritatively, the UI attempt was abandoned as redundant, not fixed.
   With `lib/ai-timeouts.ts` temporarily overwritten to `{ timeout: 5,
   maxRetries: 0 }` for both exports (restored afterwards from a `.bak`
   copy), both routes returned a clean `{"type":"error","message":"Request
   timed out."}` SSE event within **~1.5–2.5 seconds** of the request being
   made — a fast, well-formed, user-visible error instead of a stall. Raw
   captured event streams saved at
   `evidence/phase6-load-resilience/ai-timeout-screenshots/homework-sse-raw.txt`
   and `.../ilp-sse-raw.txt` — both show a normal progress sequence followed
   immediately by the `error` event, confirming the failure surfaces cleanly
   mid-flow rather than as a bare connection drop. A screenshot of the
   LessonFolder UI mid-load (`01-lesson-folder-opened.png`) is also saved
   from the abandoned UI click-through attempt referenced above.

3. **Confirmed the `Content-Encoding: identity` fix on the ILP route** by
   inspecting the raw response headers of the same direct request:
   `content-encoding: identity` present — `true`. Before the fix, this
   header was absent on the ILP route (present only on the homework route),
   meaning the ILP route was carrying the same latent Nginx-buffering
   vulnerability the homework route had already been bitten by in production.

### What was fixed

New file **`lib/ai-timeouts.ts`** — two exported constant option objects
threaded into every Anthropic client construction in the pipeline:

```ts
export const AI_ONE_SHOT_OPTS = { timeout: 60_000, maxRetries: 1 } as const
export const AI_STREAM_OPTS   = { timeout: 45_000, maxRetries: 1 } as const
```

- `AI_ONE_SHOT_OPTS` (worst case ≈120s: 60s × 2 attempts) applied to all
  9 one-shot `client.messages.create()` call sites: `generateHomeworkContent`
  and `generateHomeworkFromResources` (`app/actions/homework.ts`, both dead
  code, fixed anyway), all 6 in `app/actions/send-support.ts`
  (`generateILPForStudent`, `generateAPDRInternal`,
  `generateLearnerPassportInternal`, `generateSupportSnapshotInternal`,
  `generateIlpGoalsForStudent`, `generateILPFromConcern`), and
  `app/api/senco/generate-ilps/route.ts`'s bulk-generation client.
  `app/actions/send-support.ts`'s `suggestLessonAdaptations` (a different,
  out-of-scope feature — not homework/ILP generation) was deliberately left
  untouched. All 3 sites in `app/actions/ehcp.ts`
  (`generateIlpProgressReport`, `generateEhcpAnnualReview`,
  `generateEHCPFromILP`) also updated.
- `AI_STREAM_OPTS` (worst case ≈90s: 45s × 2 attempts, chosen to stay under
  each route's intended duration and close to the 45s client-side
  stale-stream guard so the server doesn't keep a connection open long after
  the client has already given up) applied to both SSE routes
  (`generate-homework`, `generate-ilp`).
- `generateHomeworkContent`'s `catch` block changed from silently returning
  disguised-success fallback content to throwing a clear, timeout-aware
  error message — consistent with the pattern the (currently unreachable)
  caller `HomeworkCreatorV2.tsx` already has UI for.
- `app/api/ai/generate-ilp/route.ts`: added `resultEmitted` tracking mirroring
  the homework route (set `true` after every early-return `emit(...,
  {type:'error'})` call — auth check, no API key, rate limit, duplicate ILP,
  student not found, SEND register check, JSON-parse failure), added the
  `Content-Encoding: identity` response header, and added a safety-net
  `finally` block that emits a generic error event if nothing was ever
  emitted, before `controller.close()`.

13 Anthropic call sites given explicit timeout/retry options in total.

---

## Scenario 4 — concurrent grade edits on the same submission

### What was traced

`markSubmission()` in `app/actions/homework.ts` (the single write path used
by all 3 real marking UI surfaces — `HomeworkMarkingView.tsx`,
`HomeworkMarkingV2.tsx`, `SubmissionMarkingView.tsx`) previously issued an
unconditional `prisma.submission.update({ where: { id: submissionId,
schoolId }, data: {...} })`. No optimistic-concurrency check, no
transaction guarding a read-then-write, nothing comparing the row's current
state to what the caller last saw. Whichever request's `update()` call
reached Postgres last would win, silently, with no error and no signal to
either caller that a competing write had just been discarded.

### What was tested live

Reproduced directly against the real production database using a real
submission row (captured in full before mutating, restored byte-for-byte
after, verified via readback):

1. Two `prisma.submission.update()` calls fired concurrently
   (`Promise.allSettled`) against the same submission, each setting a
   different score/feedback/grade. **Both resolved `"fulfilled"` — no error
   from either.** The row after both writes had exactly one of the two
   payloads, decided purely by network/DB timing, with the other silently
   discarded. This is the bug the task set out to confirm, and it was
   confirmed: a real silent-last-write-wins data-loss path, not a
   theoretical one.

### What was fixed

`markSubmission()` signature changed to require a 3rd parameter,
`expectedMarkedAt: Date | string | null` — the submission's `markedAt` value
as the calling UI last read it (an existing field, so this needed no schema
migration). The single `update()` call was replaced with an atomic
conditional write:

```ts
const updateResult = await prisma.submission.updateMany({
  where: { id: submissionId, schoolId, markedAt: expected },
  data:  { teacherScore: ..., finalScore: ..., feedback: ..., grade: ...,
           status: 'RETURNED', markedAt: new Date(), integrityReviewed: true,
           teacherReviewed: true },
})
if (updateResult.count === 0) {
  throw new Error(`${GRADE_CONFLICT_PREFIX} This submission was graded by
    someone else while you were working on it. Refresh to see the latest
    grade before saving again.`)
}
```

`updateMany` (not `update`) so a stale/mismatched `markedAt` fails as
`count: 0` instead of throwing a generic Prisma "record not found" error —
this makes it possible to distinguish "someone else already graded this" from
any other failure and give a specific, actionable message. `GRADE_CONFLICT_PREFIX`
was placed in a new file, **`lib/grade-conflict.ts`**, not in
`app/actions/homework.ts` itself — a `'use server'` file may only export
async functions, and a plain `const` export there breaks the Next.js/Turbopack
build (`npm run build` caught this; `tsc --noEmit` did not, since it isn't a
TypeScript-level rule). This was found and corrected before the final commit.

All 3 real UI callers updated to thread the row's `markedAt` through and
branch on the conflict:

- **`HomeworkMarkingView.tsx`** — `handleSave()` and `handleApprove()`: pass
  `selectedSub.markedAt ?? null`; on `GRADE_CONFLICT_PREFIX` catch, show
  *"Someone else already graded this submission. Refreshing to show the
  latest grade…"*, toast, and `router.refresh()`.
- **`HomeworkMarkingV2.tsx`** — `handleSave()` and `handleAcceptAndReturn()`:
  pass `sub.markedAt ?? null`; this component has no `useRouter`, so on
  conflict it shows *"Someone else already graded this submission. Reload
  the page to see the latest grade."* without an automatic refresh.
- **`SubmissionMarkingView.tsx`** — `handleSave()` and `handleApprove()`: pass
  `data.markedAt ?? null`; on conflict, shows the same refreshing message and
  calls `router.refresh()`.

`getHomeworkForMarking()` and `getSubmissionForMarking()` (the data sources
for all 3 components) already return the full `Submission` row via Prisma
`include` (not `select`), so `markedAt` was already available client-side in
all 3 components with no additional data-fetching changes needed.

### Re-verification after the fix

Re-ran the identical concurrent-write reproduction, this time against a
freshly-selected real submission (`cmtgq383e0034pd01sm1qeztc`, captured and
restored the same way), simulating the exact `updateMany` logic now inside
`markSubmission()`:

| Step | Result |
|---|---|
| Two concurrent `updateMany` calls, same `expected markedAt`, different payloads | Writer A: `count: 1` (won). Writer B: `count: 0` (correctly rejected — no silent overwrite). |
| Row state after the race | `teacherScore: 111` (writer A's value only — writer B's `222` never landed) |
| A third, "stale" retry using the original pre-race `markedAt` (simulating a teacher whose UI hasn't refreshed yet, retrying after someone else already saved) | `count: 0` — correctly rejected |
| Row state after the stale retry | Unchanged (`111`) — confirms the stale retry did not overwrite the winning write |
| Restore to original state | Confirmed via readback: `teacherScore`, `markedAt`, and all other fields match the pre-test snapshot exactly |

This proves the fix works as designed: exactly one of two racing writers
succeeds, the other is rejected with an atomic `count: 0` (not a partial or
torn write), and the real `markSubmission()` code path (verified by direct
read of `app/actions/homework.ts` lines ~1364–1413 after the edit) implements
precisely this logic — the isolated test used the same `where`/`data` shape
the live function uses, not a simplified stand-in.

### Test hygiene

Both Scenario 4 database tests ran against real rows in the production/demo
database (there being no isolated test environment available, per the same
constraint noted throughout Phase 5/6). Each test captured the full original
row via Prisma before mutating it and restored it via a final `update()` call
immediately afterward, with the restore itself verified by a readback
comparison. No temporary script files were left in the repo (`scripts/
_scenario4-verify.mjs` and its `/tmp` counterpart were both deleted after
use). No schema changes were required.

---

## Verification

- `npx tsc --noEmit` — exit 0, no errors.
- `npm run build` — exit 0. (First attempt failed here specifically because
  of the `GRADE_CONFLICT_PREFIX` `'use server'` export-rule violation
  described above; `tsc` had not caught it. Fixed by moving the constant to
  `lib/grade-conflict.ts`, then both commands passed clean.)

## Honest gaps / what this does not cover

- Neither scenario was run as a scripted, repeatable chaos-test harness (e.g.
  k6 fault injection) — both were reproduced by direct, hand-written scripts
  against the real API/DB. Sufficient to prove the failure mode and the fix,
  but not a repeatable regression test living in CI.
- Scenario 2's UI click-through (as opposed to the direct SSE-level test) was
  not completed — the Playwright locator for the "Homework tab" button did
  not match the live DOM and this was not debugged further, since the
  SSE-level test already gives an authoritative answer for what the user's
  browser actually receives.
- The `generateHomeworkContent`/`HomeworkCreatorV2.tsx` fix (Scenario 2) is
  confirmed dead code today — it closes a *latent* gap, not a currently live
  one. If this component is ever wired up to a real route in future, the
  fix will already be in place; but it was not the source of any live user
  impact at the time of testing.
- Load-level concurrency (many simultaneous grade edits/generations under
  real traffic, not just two hand-fired requests) is still 6.1's job, not
  this document's — 6.1 remains not run, see the checklist.
