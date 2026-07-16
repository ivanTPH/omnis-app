# Phase 6.2 / 6.3 — Failure Testing Plan & Backup Status (prepared, not yet executed)

**Date:** 10 July 2026

## Confirmed real infrastructure

Via the connected Supabase MCP: project **"Ivan Omnis"**
(`ppmckscpekgwfeofvjej`, region `eu-central-1`, Postgres 17.6, status
`ACTIVE_HEALTHY`) — this is the real project `DATABASE_URL`/`DIRECT_URL`
point at. A second project (`legacy-fortress-web`) also exists under the
same organisation but is unrelated to Omnis.

## 6.3 — Backup & recovery: status unknown, needs manual confirmation

The Supabase MCP connector available in this session doesn't expose backup/
PITR (point-in-time recovery) configuration directly. **This needs manual
confirmation in the Supabase dashboard → Database → Backups.** Specifically:

- [ ] Confirm which plan tier the project is on — Supabase's Free tier has
      **no PITR and very limited backup retention**; if this project is
      still on Free, that's a go-live blocker on its own, independent of
      everything else in this checklist
- [ ] If on a paid tier: confirm daily backup retention window and whether
      PITR is enabled
- [ ] Only after confirming backups exist: run an actual restore drill into
      a scratch project/branch and record recovery time

**Do not assume backups are configured — verify.**

## 6.2 — Failure/chaos test plan

Each scenario below needs a safe (non-production) target to execute against
— same constraint as Phase 5.1/5.3/6.1. Documented here so it's ready to run
the moment that's available; none of these have been executed yet.

| # | Scenario | How to simulate | What "pass" looks like |
|---|---|---|---|
| 1 | Wonde API timeout/downtime mid-sync | Point `WONDE_API_URL` at a black-hole/non-routable address temporarily, trigger `/api/wonde/sync` | Sync fails with a clear error surfaced in `WondeSyncPanel`, not a hang; no partial/corrupt data left in `WondeSyncLog` |
| 2 | AI provider timeout during homework/ILP generation | Point `ANTHROPIC_API_KEY` at an invalid value or use a network rule to block the Anthropic API host, trigger `/api/ai/generate-homework` and `/api/ai/generate-ilp` | User sees the "Generation failed — please try again" message documented in Trial Readiness Plan §4.3, not an infinite spinner |
| 3 | Database connection loss mid-request | Temporarily drop `connection_limit` to 0 or revoke DB user access during an active homework submission | Student's in-progress answer isn't lost — Trial Readiness Plan §4.3 already documents localStorage draft-save in `HomeworkSubmissionView`; this test confirms it actually recovers the draft after reconnecting |
| 4 | Concurrent grade edits on the same submission | Two authenticated sessions submit a grade for the same `Submission.id` within the same second | No silently lost write — either last-write-wins with both teachers seeing the final state, or an explicit conflict message; confirm which behaviour actually happens (not yet known) |

## Recommended execution order

Once a safe target environment exists (Vercel preview + Supabase branch,
per the Phase 5 discussion): run 6.1 (load-test-script.js) light routes
first to confirm the environment itself is healthy, then work through
scenarios 1–4 above one at a time, recording pass/fail and screenshots in
this same folder.
