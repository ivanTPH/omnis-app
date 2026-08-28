# Omnis — silent-failure sweep (2026-08-28)

Prompted directly by a founder concern: "the application falling silent, not
doing anything, and the system not flagging it, so people would think things
have happened even when they haven't." That's the exact failure class fixed
in the 4 agent crons earlier today (see
`docs/audit/2026-08-27-resilience-audit.md` finding #3) — this pass checks
every *other* cron route and the Wonde/Oak sync paths for the same shape.

## STATUS: 8 findings fixed. One fix (`low-attendance` scheduling) needs a
manual paste into `.github/workflows/crons-weekly.yml` since that path is
protected from automated edits — given to Ivan directly, not yet confirmed
applied at time of writing.

## Fixed

1. **Root cause, upstream of 13 other routes — `lib/email.ts`'s shared
   `send()` helper swallowed every error and never surfaced it anywhere.**
   By design ("email delivery must not break server actions") it caught and
   logged to `console.error` only — no throw, no rejection. That's correct
   for the "don't break a server action because an email failed" goal, but
   it also meant a revoked `RESEND_API_KEY` or a full Resend outage was
   invisible to *every* caller, including cron routes whose own per-item
   error handling could never detect it, because the failure never reached
   them. Fixed by having `send()` report to Sentry on failure (`captureException`,
   tagged `job: 'email-send'`) while still never throwing — the "don't break
   callers" contract is unchanged (all 31 internal call sites discard the
   return value as before), but a systemic email outage now actually surfaces
   somewhere once Sentry has a DSN, instead of nowhere.

2. **`low-attendance` — the weekly attendance-drop alert to HOY/SLT has never
   run once.** The route exists, is well-written, and is simply not
   referenced in any of the three GitHub Actions cron workflow files. This is
   the purest version of the founder's stated concern: people would
   reasonably believe attendance-drop alerts go out weekly (attendance is a
   core SEND indicator), and none ever have. Scheduling requires editing
   `.github/workflows/crons-weekly.yml`, which is outside what this session's
   repo-write path can touch — handed to Ivan as a direct paste-and-run
   script (adds `0 9 * * 1`, Monday 09:00 UTC, alongside the existing weekly
   digests). Not yet confirmed applied.

3. **`app/api/cron/early-warning/route.ts` — the largest remaining instance
   of the exact pattern fixed in the 4 agent crons.** This route runs 5
   largely-independent phases (early-warning pattern analysis, ILP/EHCP
   review-due checks, adaptive profile refresh, cohort aggregate rollup,
   evidence-agent linking) — all safeguarding/SEND-relevant — each swallowing
   per-school errors and always returning `success: true` regardless of how
   many schools failed in any phase. Fixed by tracking each phase's error
   count separately (a school-loop error in one phase doesn't invalidate the
   others) and flagging + reporting to Sentry + returning 502 specifically
   when a whole phase failed for every school — the "this capability silently
   stopped working entirely" case — while leaving normal per-school noise
   (one school out of forty having a bad day) as non-fatal, matching the
   `processed === 0 && errors > 0` philosophy already established for the
   agent crons.

4. **Four routes computed their own error state correctly but never acted on
   it: `review-due`, `apdr-review`, `concern-stale`, `year-rollover`.** Each
   already built an `errors: string[]` array and (three of the four) an `ok`
   boolean reflecting it — but every one of them still returned HTTP 200
   unconditionally, so `curl -sf` in the GitHub Actions workflow never
   noticed. Fixed all four to return 502 (with a Sentry `reportSystemicFailure`
   call) specifically when *every* attempted unit failed — not on any single
   error, to avoid false-alarming on normal batch noise. `year-rollover` is
   the highest-stakes of the four: it fires once a year (1 September, 4 days
   from today) and mutates real state — year-group promotion and Year 13
   deactivation for every active student in every school. A silent total
   failure there previously would have left every school's students in the
   wrong year group for a full year with zero alert and zero indication
   anything was wrong beyond an `errors` array nobody was checking.

5. **`oak-sync` — bulk and delta sync both track `errorCount` per subject/
   lesson without throwing, so a total sync failure (Oak API auth expired,
   a schema drift breaking every write) looked identical to "ran fine,
   nothing changed this week."** Fixed at the route level (covers both sync
   paths without duplicating logic in each): flags and reports to Sentry when
   errors were recorded *and* nothing was actually created or updated
   anywhere (subjects, units, and lessons all zero), returning 502 in that
   case. A partial sync with some real writes and some errors still returns
   200 — that's the sync doing its job, not silently failing.

6. **`app/api/wonde/sync/route.ts` always reported `success: true` in its
   JSON response even when the sync log it wrote to the same request was
   correctly marked `'partial'`.** Lower severity than the others — this is
   admin-triggered, not an unattended nightly cron, and the persisted
   `WondeSyncLog.status` was already accurate, so an admin checking the
   Wonde admin panel's history would see the truth regardless. Still fixed
   for consistency, since the immediate API response is what a script or a
   less-attentive admin would actually look at.

## Not fixed — lower priority, noted for a future pass

- **`Promise.allSettled` result-discarding in `apdr-review` and
  `concern-stale`.** Both do `sent += sencos.length` right after
  `Promise.allSettled(...)` without checking which promises actually
  fulfilled — in principle this overcounts if an individual send fails. In
  practice this is currently moot: the email template functions (e.g.
  `sendApdrReviewReminderEmail`) wrap `lib/email.ts`'s `send()`, which (even
  after today's fix) still never throws and still returns `Promise<void>` at
  the template-function level — so every settled promise looks
  `'fulfilled'` regardless of whether the underlying send actually
  succeeded, and there's nothing for `allSettled` to distinguish yet. Fixing
  this properly means threading the boolean `send()` now returns up through
  every exported template function's return type (`Promise<void>` →
  `Promise<boolean>`) — a wider, more mechanical change across ~15+ functions
  in `lib/email.ts` that didn't feel right to rush into the same pass as
  everything else above. The higher-value fix (Sentry actually seeing email
  failures at all) is done; propagating success/failure through every
  template function is a real but lower-urgency follow-up.
- A full audit of every non-cron route for the same "computed but unused
  error state" pattern — this pass covered `app/api/cron/*` and the Wonde/Oak
  sync paths specifically, not the ~70 other API routes.

## Not covered by this pass

- Everything in `docs/audit/2026-08-27-resilience-audit.md`'s "not covered"
  section still applies (DSPy/Wonde retry/backoff gaps, the e2e/production
  architecture question).
- The email-template return-type propagation noted above.
