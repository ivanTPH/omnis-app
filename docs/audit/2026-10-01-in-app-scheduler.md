# Scheduler, MIS review page and duplicate AI source (1 October 2026)

## Findings from the rehearsal school's first run
- **GitHub ran the nightly jobs hours late.** The Wonde sync was due at 01:15 UTC and ran at 07:10, and agent-coach ran at 09:13. GitHub delays or drops scheduled workflows when it is busy.
- **An old Vercel production deployment is still live** (project `omnis-app`, `prj_seoaNDXnbsTzHE7qst21zzpbCNgr`, commit a0ef0e4 from 12 July, omnis-app-ten.vercel.app). Its `vercel.json` crons (agents, digests, monthly emails) run against the production database with the AI key. On 1 October it ran 122 PLAN_SYNTHESIS analyses and the send-monthly and engagement-digest jobs.
  - This must be paused or deleted in the Vercel dashboard. The API token here has no permission to do it.
- **Oakfield Academy** (`cmmj8blef0000u1xybb969a40`), the old synthetic Wonde test school, has been retired (`isActive = false`).

## Changes
- **In-app scheduler.** `lib/scheduler/` contains `jobs.ts` (the schedule, in UTC), `cron.ts` (a matcher, with tests) and `runner.ts`. It is started from `instrumentation.ts` in the Node.js runtime. Every minute it calls each cron route that is due on `http://127.0.0.1:$PORT` with the CRON_SECRET bearer token.
  - It only runs in production. Turn it off with `IN_APP_CRON=off`, for example if Omnis ever runs on more than one container.
  - Failures are reported to Sentry.
- **GitHub cron workflows** are now manual-only (Actions → Run workflow). The one exception is the weekly DSPy job (`30 2 * * 0`), which needs Python.
- **E2E workflow** no longer triggers a second Coolify deploy. Coolify's webhook already deploys on push, and the two deploys were clashing.
- **"Check MIS data" page** (`/admin/mis-review`, built on `lib/mis-review.ts` and `app/actions/mis-review.ts`):
  - the last sync summarised in plain English (`WondeSyncLog.summary`)
  - classes with no teacher, with an Assign control
  - a staff roles editor
  - a CSV download of pupils without an email (`/api/admin/pupils-missing-email`); the CSV import skips rows with a blank email
  - a count of pupils with no parent email
  - The go-live checklist links to each section.
- **Audit fix (c58d84a).** Accounts created from the MIS are audited with the new user as the actor, because `AuditLog.actorId` has a foreign key to User.
