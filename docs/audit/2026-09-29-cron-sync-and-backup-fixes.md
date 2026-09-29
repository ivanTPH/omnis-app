# Scheduled jobs, MIS sync and backups — fixes (29 Sep 2026)

Triggered by open issues in Sentry (project `javascript-nextjs`, EU region). Evidence was
gathered from Sentry, the GitHub Actions run history for the `Cron Jobs - *` workflows,
and the production database (`OakSyncLog`, `WondeSyncLog`, `SchoolCohortAggregate`,
`AgentOptimizationRun`).

## 1. Early-warning cron: cohort aggregates never saved (FIXED)

- **Symptom:** Sentry `JAVASCRIPT-NEXTJS-6`, `PrismaClientValidationError` on
  `prisma.schoolCohortAggregate.upsert()` from `GET /api/cron/early-warning`: 54 events over
  4 weeks, one per school per run.
- **Evidence:** `SchoolCohortAggregate` had **0 rows for every school**. The feature has never
  produced any data, so `platform-insights` (which reads it) has had nothing to work with.
- **Cause:** `lib/cohort-aggregate.ts` upserted the school-wide row with
  `where: { schoolId_subject_yearGroup: { …, yearGroup: null } }`. Prisma rejects `null` inside a
  compound-unique `where`. The `as any` cast hid this from `tsc`. The throw also skipped the
  per-year rollups that follow it.
- **Fix:** look up the school-wide row with `findFirst({ yearGroup: null })`, then
  `update` by id or `create`. This also avoids duplicates, because Postgres treats NULLs as
  distinct in the `@@unique`.
- **Verify after deploy:** the next weekday run (06:00 UTC schedule) should write rows:
  `select count(*) from "SchoolCohortAggregate"` > 0, and no new events on JAVASCRIPT-NEXTJS-6.

## 2. Wonde MIS sync: never scheduled, and not tenant-safe (FIXED)

- **Evidence:** the last Wonde sync was **11 June 2026** (status `partial`; its contact-upsert error
  was fixed the same day in `855e3f1`). Nothing ran it after that: there was no cron, only
  the admin "Run Sync" button.
- **Tenant-safety bug:** `POST /api/wonde/sync` and `triggerWondeSync()` imported the Wonde
  school configured in env (`WONDE_SCHOOL_ID`) into **whichever school the calling admin
  belonged to**. An admin at a different school could therefore pull another school's pupils into their own
  tenant.
- **Fix:**
  - New `lib/wonde-sync-runner.ts`: `resolveWondeTarget()` maps `WONDE_SCHOOL_ID` to the
    Omnis school via its `WondeSchool` link row and refuses any other caller's school.
    `runLoggedWondeSync()` is shared by the button, the server action and the cron, so all
    three write the same `WondeSyncLog` rows.
  - New `GET /api/cron/wonde-sync`. It answers 202 and runs the sync after the response
    (`next/server` `after()`), reporting to Sentry on failure. It is scheduled nightly at
    01:15 UTC in `crons-agents.yml`.
- **Still open:** the design supports one Wonde school, from env. Before a second real
  school, move to per-school tokens (`WondeSchool.wondeToken`, which should be encrypted at rest;
  it is currently stored in plain text).

## 3. Oak content sync: weekly GitHub step "failed" although the sync worked (FIXED)

- **Evidence:** `OakSyncLog` shows every weekly bulk sync **completed** (~43–50 minutes, 0
  errors), but the GitHub step times out after 310 s and is marked failed (e.g. 27 Sep).
- **Fix:** `GET /api/cron/oak-sync` now answers 202 and runs the sync in the background.
  The step timeout is now 60 s. The platform-admin "Run sync" button now says the sync has started,
  rather than waiting 45 minutes.
- **Note:** a second, **delta** sync appears in `OakSyncLog` every Sunday at 02:56 UTC. It is not
  triggered from this repo's workflows; it is probably a Coolify scheduled task. Harmless, but worth tidying.

## 4. DSPy weekly optimisation: failing before doing anything (FIXED)

- **Evidence:** `AgentOptimizationRun` has 0 rows. The Sunday `dspy-weekly-optimize` step failed
  on 27 Sep.
- **Cause (reproduced):** the job reuses the app's `DATABASE_URL` secret, which carries
  Prisma-only options (`?pgbouncer=true&connection_limit=…`). psycopg2/libpq rejects these:
  `invalid URI query parameter: "pgbouncer"`.
- **Fix:** `dspy-service/data.py` strips Prisma-only query options before connecting, keeping the
  pooled host, because Supabase's direct host is IPv6-only and GitHub runners cannot reach it.
- **Expected behaviour after the fix:** "No pair has enough reviewed examples. Nothing to do."
  until 40+ teacher-reviewed agent outputs exist per skill. That is normal.

## 5. Other Sentry issues (no code change)

| Issue | Assessment |
|---|---|
| `[agent-engage] systemic failure: all 11 schools failed` (once, ~22 Sep) | One-off. Every agent-engage run since has succeeded. Most likely an AI provider outage that night. Mark resolved; it will reopen if it recurs. |
| `classTeacher.findMany` timed out (staff-workload export) | A single slow query on the Free-tier database. Revisit after the plan upgrade (below). |
| `Unauthenticated` /calendar, `aborted`, `destination stream closed early` | Normal client behaviour (expired session, user navigated away). Resolve. |
| `Failed to find Server Action` / `UnrecognizedActionError` | A page left open across a deploy. Harmless; clears on refresh. Resolve. |

## 6. Backups (NOT fixed — needs a plan upgrade and school input)

- The Supabase organisation "Ivan MVP" is on the **Free** plan (confirmed 29 Sep via the Supabase API):
  no daily backups you can restore yourself, no point-in-time recovery, and free projects are **paused after
  1 week of inactivity**.
- Supabase Pro is $25/month and includes **daily backups kept for 7 days**. Point-in-time recovery is an add-on
  ($100/month per 7 days of retention) and may need a larger compute size.
- **Action (Ivan):** upgrade the organisation to Pro in the Supabase dashboard (Billing). Then
  do a restore test into a new or branch project and record how long it took in
  `evidence/phase6-load-resilience/backup-drill.md`.
- **Action (school):** answer the two questions in the readiness report (section 3.2): how much
  data loss is acceptable, and how long the school could manage without Omnis. These decide
  whether point-in-time recovery is needed.

## Verification done in this session

- `tsc --noEmit`: clean. `eslint` on the changed files: 0 errors (3 pre-existing warnings).
- libpq DSN cleaning tested against a local Postgres.
- Not run locally: `next build`. The Prisma engine downloads were blocked in this environment. The
  Coolify build (which rolls back automatically on failure) is the build check. Confirm it goes green
  after pushing.
